/**
 * Payment Service
 *
 * Handles Stripe payment processing for The Commissary including:
 * - PaymentIntent creation and confirmation
 * - Apple Pay and credit card support
 * - Refund processing
 * - Customer management
 * - Webhook event handling
 */

import Stripe from 'stripe';
import { config } from '@/config';
import { prisma } from '@/config/database';
import logger from '@/utils/logger';

class PaymentService {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(config.stripe.secretKey, {
      apiVersion: '2025-02-24.acacia',
      typescript: true,
    });
  }

  /**
   * Create a PaymentIntent for order payment
   * Supports both Apple Pay and credit cards
   *
   * @param amount - Amount in cents
   * @param currency - Currency code (e.g., 'usd')
   * @param metadata - Order and user metadata
   * @returns PaymentIntent object
   */
  async createPaymentIntent(
    amount: number,
    currency: string,
    metadata: { orderId?: string; userId: string }
  ): Promise<Stripe.PaymentIntent> {
    try {
      // Get user details for customer creation and receipt
      const user = await prisma.user.findUnique({
        where: { id: metadata.userId },
        select: { email: true, stripeCustomerId: true },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Get or create Stripe customer
      const customerId = await this.getOrCreateCustomer(metadata.userId, user.email);

      // Get order number if orderId is provided
      let orderNumber: string | undefined;
      if (metadata.orderId) {
        const order = await prisma.order.findUnique({
          where: { id: metadata.orderId },
          select: { orderNumber: true },
        });
        orderNumber = order?.orderNumber.toString();
      }

      // Generate idempotency key
      const idempotencyKey = `order_${metadata.orderId || 'temp'}_${Date.now()}`;

      // Create PaymentIntent with support for Apple Pay and cards
      const paymentIntent = await this.stripe.paymentIntents.create(
        {
          amount,
          currency,
          customer: customerId,
          payment_method_types: ['card'], // Supports Apple Pay via card payment method
          metadata: {
            orderId: metadata.orderId || '',
            orderNumber: orderNumber || '',
            userId: metadata.userId,
          },
          description: orderNumber
            ? `The Commissary Order #${orderNumber}`
            : 'The Commissary Order',
          receipt_email: user.email,
        },
        { idempotencyKey }
      );

      logger.info('PaymentIntent created', {
        paymentIntentId: paymentIntent.id,
        amount,
        currency,
        userId: metadata.userId,
        orderId: metadata.orderId,
      });

      return paymentIntent;
    } catch (error) {
      logger.error('Failed to create PaymentIntent', { error, metadata, amount });
      throw this.handleStripeError(error);
    }
  }

  /**
   * Confirm a PaymentIntent with a payment method
   * Used for iOS app when confirming with Apple Pay or card
   *
   * @param paymentIntentId - Stripe PaymentIntent ID
   * @param paymentMethodId - Stripe PaymentMethod ID from client
   * @returns Confirmed PaymentIntent
   */
  async confirmPayment(
    paymentIntentId: string,
    paymentMethodId: string
  ): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: paymentMethodId,
      });

      logger.info('PaymentIntent confirmed', {
        paymentIntentId,
        status: paymentIntent.status,
        paymentMethod: paymentMethodId,
      });

      return paymentIntent;
    } catch (error) {
      logger.error('Failed to confirm PaymentIntent', { error, paymentIntentId });
      throw this.handleStripeError(error);
    }
  }

  /**
   * Refund a payment (full or partial)
   *
   * @param paymentIntentId - Stripe PaymentIntent ID
   * @param amount - Optional partial refund amount in cents (omit for full refund)
   * @returns Refund object
   */
  async refundPayment(
    paymentIntentId: string,
    amount?: number,
    reason?: string
  ): Promise<Stripe.Refund> {
    try {
      const refundParams: Stripe.RefundCreateParams = {
        payment_intent: paymentIntentId,
      };

      if (amount) {
        refundParams.amount = amount;
      }

      if (reason) {
        refundParams.metadata = { reason };
      }

      const refund = await this.stripe.refunds.create(refundParams);

      logger.info('Payment refunded', {
        paymentIntentId,
        refundId: refund.id,
        amount: refund.amount,
        status: refund.status,
        reason,
      });

      return refund;
    } catch (error) {
      logger.error('Failed to refund payment', { error, paymentIntentId, amount });
      throw this.handleStripeError(error);
    }
  }

  /**
   * Get or create a Stripe customer for a user
   * Manages customer records for easier payment management
   *
   * @param userId - User ID
   * @param email - User email
   * @returns Stripe customer ID
   */
  async getOrCreateCustomer(userId: string, email: string): Promise<string> {
    try {
      // Check if user already has a Stripe customer ID
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { stripeCustomerId: true },
      });

      if (!user) {
        throw new Error('User not found');
      }

      if (user.stripeCustomerId) {
        // Verify customer exists in Stripe
        try {
          await this.stripe.customers.retrieve(user.stripeCustomerId);
          return user.stripeCustomerId;
        } catch (error) {
          // Customer doesn't exist in Stripe, create new one
          logger.warn('Stripe customer not found, creating new one', {
            userId,
            oldCustomerId: user.stripeCustomerId,
          });
        }
      }

      // Create new Stripe customer
      const customer = await this.stripe.customers.create({
        email,
        metadata: { userId },
      });

      // Save customer ID to user record
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customer.id },
      });

      logger.info('Stripe customer created', {
        userId,
        customerId: customer.id,
      });

      return customer.id;
    } catch (error) {
      logger.error('Failed to get or create customer', { error, userId });
      throw this.handleStripeError(error);
    }
  }

  /**
   * Handle Stripe webhook events
   * Verifies signature and processes payment events
   *
   * @param payload - Raw webhook payload (Buffer)
   * @param signature - Stripe signature header
   * @returns Event type and handling status
   */
  async handleWebhook(
    payload: Buffer,
    signature: string
  ): Promise<{ event: string; handled: boolean }> {
    try {
      // Verify webhook signature
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        config.stripe.webhookSecret
      );

      logger.info('Webhook received', {
        type: event.type,
        id: event.id,
      });

      let handled = false;

      // Handle specific events
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
          handled = true;
          break;

        case 'payment_intent.payment_failed':
          await this.handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
          handled = true;
          break;

        case 'charge.refunded':
          await this.handleChargeRefunded(event.data.object as Stripe.Charge);
          handled = true;
          break;

        case 'charge.dispute.created':
          await this.handleDisputeCreated(event.data.object as Stripe.Dispute);
          handled = true;
          break;

        default:
          logger.info('Unhandled webhook event type', { type: event.type });
      }

      return { event: event.type, handled };
    } catch (error) {
      logger.error('Webhook handling failed', { error });
      throw error;
    }
  }

  /**
   * Handle successful payment event
   * Updates order payment status to PAID
   */
  private async handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    try {
      const orderId = paymentIntent.metadata.orderId;

      if (!orderId) {
        logger.warn('PaymentIntent succeeded but no orderId in metadata', {
          paymentIntentId: paymentIntent.id,
        });
        return;
      }

      // Update order payment status
      await prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'PAID',
          stripePaymentIntentId: paymentIntent.id,
        },
      });

      logger.info('Order payment status updated to PAID', {
        orderId,
        paymentIntentId: paymentIntent.id,
      });
    } catch (error) {
      logger.error('Failed to handle payment succeeded', {
        error,
        paymentIntentId: paymentIntent.id,
      });
    }
  }

  /**
   * Handle failed payment event
   * Updates order payment status and logs failure
   */
  private async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    try {
      const orderId = paymentIntent.metadata.orderId;

      if (!orderId) {
        logger.warn('PaymentIntent failed but no orderId in metadata', {
          paymentIntentId: paymentIntent.id,
        });
        return;
      }

      // Update order payment status
      await prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'FAILED',
          stripePaymentIntentId: paymentIntent.id,
        },
      });

      logger.error('Payment failed for order', {
        orderId,
        paymentIntentId: paymentIntent.id,
        lastError: paymentIntent.last_payment_error,
      });
    } catch (error) {
      logger.error('Failed to handle payment failed', {
        error,
        paymentIntentId: paymentIntent.id,
      });
    }
  }

  /**
   * Handle charge refunded event
   * Updates order payment status to REFUNDED
   */
  private async handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
    try {
      const paymentIntentId = charge.payment_intent as string;

      if (!paymentIntentId) {
        logger.warn('Charge refunded but no payment_intent', { chargeId: charge.id });
        return;
      }

      // Find order by payment intent ID
      const order = await prisma.order.findFirst({
        where: { stripePaymentIntentId: paymentIntentId },
      });

      if (!order) {
        logger.warn('Charge refunded but order not found', { paymentIntentId });
        return;
      }

      // Update order payment status
      await prisma.order.update({
        where: { id: order.id },
        data: { paymentStatus: 'REFUNDED' },
      });

      logger.info('Order payment status updated to REFUNDED', {
        orderId: order.id,
        chargeId: charge.id,
      });
    } catch (error) {
      logger.error('Failed to handle charge refunded', {
        error,
        chargeId: charge.id,
      });
    }
  }

  /**
   * Handle dispute created event (chargeback)
   * Logs alert for admin attention
   */
  private async handleDisputeCreated(dispute: Stripe.Dispute): Promise<void> {
    try {
      const paymentIntentId = dispute.payment_intent as string;

      logger.error('DISPUTE ALERT: Chargeback initiated', {
        disputeId: dispute.id,
        paymentIntentId,
        amount: dispute.amount,
        reason: dispute.reason,
        status: dispute.status,
      });

      // Find order if we have payment intent ID
      if (paymentIntentId) {
        const order = await prisma.order.findFirst({
          where: { stripePaymentIntentId: paymentIntentId },
        });

        if (order) {
          logger.error('Dispute for order', {
            orderId: order.id,
            orderNumber: order.orderNumber,
            disputeId: dispute.id,
          });
        }
      }
    } catch (error) {
      logger.error('Failed to handle dispute created', {
        error,
        disputeId: dispute.id,
      });
    }
  }

  /**
   * Map Stripe errors to user-friendly messages
   * SECURITY: Never log card numbers or CVC
   */
  private handleStripeError(error: any): Error {
    if (error instanceof Stripe.errors.StripeError) {
      const code = error.code;

      // User-friendly error messages
      const errorMessages: Record<string, string> = {
        card_declined: 'Your card was declined. Please try a different card.',
        insufficient_funds: 'Insufficient funds. Please try a different card.',
        expired_card: 'Your card has expired. Please use a different card.',
        incorrect_cvc: 'Incorrect security code. Please check and try again.',
        processing_error: 'An error occurred. Please try again.',
        invalid_number: 'Invalid card number. Please check and try again.',
        invalid_expiry_month: 'Invalid expiration month.',
        invalid_expiry_year: 'Invalid expiration year.',
        incorrect_number: 'Incorrect card number. Please check and try again.',
        incomplete_number: 'Card number is incomplete.',
        incomplete_cvc: 'Security code is incomplete.',
        incomplete_expiry: 'Card expiration date is incomplete.',
      };

      const message = code ? errorMessages[code] : undefined;

      return new Error(message || error.message || 'Payment processing failed');
    }

    return error;
  }
}

// Export singleton instance
export default new PaymentService();
