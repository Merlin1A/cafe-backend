/**
 * Print Service
 *
 * Manages print job queue for kitchen and beverage printers.
 * Creates jobs based on order items and printer destinations.
 */

import { prisma } from '@/config/database';
import logger from '@/utils/logger';
import { PrinterType, PrintStatus } from '@prisma/client';

// ============================================================================
// TYPES
// ============================================================================

interface ReceiptData {
  orderNumber: number;
  orderTime: string;
  customerName: string;
  items: {
    name: string;
    quantity: number;
    modifiers: string[];
    specialInstructions?: string;
  }[];
  specialInstructions?: string;
}

interface OrderWithItems {
  id: string;
  orderNumber: number;
  createdAt: Date;
  specialInstructions: string | null;
  user: {
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  orderItems: {
    id: string;
    quantity: number;
    specialInstructions: string | null;
    menuItem: {
      name: string;
      printerDestination: string;
    };
    selectedModifiers: {
      modifierName: string;
    }[];
  }[];
}

// ============================================================================
// PRINT SERVICE
// ============================================================================

class PrintService {
  /**
   * Create print jobs for an order
   * Analyzes items by printer destination and creates appropriate jobs
   *
   * @param order - Order with items
   * @returns Array of created print jobs
   */
  async createPrintJobs(order: OrderWithItems): Promise<any[]> {
    try {
      const kitchenItems = this.getItemsForPrinter(order.orderItems, 'KITCHEN');
      const beverageItems = this.getItemsForPrinter(order.orderItems, 'BEVERAGE');

      const jobs: any[] = [];

      // Create kitchen job if there are kitchen items
      if (kitchenItems.length > 0) {
        const receiptData = this.generateReceiptData(order, 'KITCHEN');

        const kitchenJob = await prisma.printJob.create({
          data: {
            orderId: order.id,
            printerType: PrinterType.KITCHEN,
            status: PrintStatus.PENDING,
            receiptData: receiptData as any,
            attempts: 0,
          },
        });

        jobs.push(kitchenJob);
        logger.info('Kitchen print job created', {
          jobId: kitchenJob.id,
          orderId: order.id,
          orderNumber: order.orderNumber,
        });
      }

      // Create beverage job if there are beverage items
      if (beverageItems.length > 0) {
        const receiptData = this.generateReceiptData(order, 'BEVERAGE');

        const beverageJob = await prisma.printJob.create({
          data: {
            orderId: order.id,
            printerType: PrinterType.BEVERAGE,
            status: PrintStatus.PENDING,
            receiptData: receiptData as any,
            attempts: 0,
          },
        });

        jobs.push(beverageJob);
        logger.info('Beverage print job created', {
          jobId: beverageJob.id,
          orderId: order.id,
          orderNumber: order.orderNumber,
        });
      }

      return jobs;
    } catch (error) {
      logger.error('Failed to create print jobs', { error, orderId: order.id });
      throw error;
    }
  }

  /**
   * Print kitchen ticket for an order
   * Creates print jobs for kitchen items
   *
   * @param order - Order to print
   * @returns True if print job created
   */
  async printKitchenTicket(order: any): Promise<boolean> {
    try {
      const kitchenItems = this.getItemsForPrinter(order.orderItems, 'KITCHEN');

      if (kitchenItems.length === 0) {
        logger.warn('No kitchen items to print', { orderId: order.id });
        return false;
      }

      const receiptData = this.generateReceiptData(order, 'KITCHEN');

      await prisma.printJob.create({
        data: {
          orderId: order.id,
          printerType: PrinterType.KITCHEN,
          status: PrintStatus.PENDING,
          receiptData: receiptData as any,
          attempts: 0,
        },
      });

      logger.info('Kitchen ticket print job created', {
        orderId: order.id,
        orderNumber: order.orderNumber,
      });

      return true;
    } catch (error) {
      logger.error('Failed to print kitchen ticket', { error, orderId: order.id });
      return false;
    }
  }

  /**
   * Print receipt for an order
   * Creates print jobs for all items (customer receipt)
   *
   * @param order - Order to print
   * @returns True if print job created
   */
  async printReceipt(order: any): Promise<boolean> {
    try {
      // For customer receipts, we typically print all items together
      // Using KITCHEN printer type as default, but this could be a separate RECEIPT type
      const receiptData = this.generateReceiptData(order, 'KITCHEN');

      await prisma.printJob.create({
        data: {
          orderId: order.id,
          printerType: PrinterType.KITCHEN, // Could add RECEIPT printer type
          status: PrintStatus.PENDING,
          receiptData: receiptData as any,
          attempts: 0,
        },
      });

      logger.info('Receipt print job created', {
        orderId: order.id,
        orderNumber: order.orderNumber,
      });

      return true;
    } catch (error) {
      logger.error('Failed to print receipt', { error, orderId: order.id });
      return false;
    }
  }

  /**
   * Get pending print jobs
   * Returns jobs that need to be printed
   *
   * @returns Array of pending print jobs with receipt data
   */
  async getPendingJobs(): Promise<any[]> {
    try {
      const jobs = await prisma.printJob.findMany({
        where: {
          status: PrintStatus.PENDING,
        },
        include: {
          order: {
            include: {
              user: {
                select: {
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
              orderItems: {
                include: {
                  menuItem: {
                    select: {
                      name: true,
                      printerDestination: true,
                    },
                  },
                  selectedModifiers: {
                    select: {
                      modifierName: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
        take: 100,
      });

      logger.info('Fetched pending print jobs', { count: jobs.length });

      return jobs;
    } catch (error) {
      logger.error('Failed to fetch pending jobs', { error });
      throw error;
    }
  }

  /**
   * Mark job as sent to print server
   *
   * @param jobId - Print job ID
   */
  async markJobSent(jobId: string): Promise<void> {
    try {
      await prisma.printJob.update({
        where: { id: jobId },
        data: {
          status: PrintStatus.SENT,
          sentAt: new Date(),
        },
      });

      logger.info('Print job marked as sent', { jobId });
    } catch (error) {
      logger.error('Failed to mark job as sent', { error, jobId });
      throw error;
    }
  }

  /**
   * Mark job as printed successfully
   *
   * @param jobId - Print job ID
   */
  async markJobPrinted(jobId: string): Promise<void> {
    try {
      await prisma.printJob.update({
        where: { id: jobId },
        data: {
          status: PrintStatus.PRINTED,
          printedAt: new Date(),
        },
      });

      logger.info('Print job marked as printed', { jobId });
    } catch (error) {
      logger.error('Failed to mark job as printed', { error, jobId });
      throw error;
    }
  }

  /**
   * Mark job as failed
   * Increments attempt counter
   *
   * @param jobId - Print job ID
   * @param errorMessage - Error message
   */
  async markJobFailed(jobId: string, errorMessage: string): Promise<void> {
    try {
      await prisma.printJob.update({
        where: { id: jobId },
        data: {
          status: PrintStatus.FAILED,
          lastError: errorMessage,
          attempts: {
            increment: 1,
          },
        },
      });

      logger.error('Print job marked as failed', { jobId, errorMessage });
    } catch (error) {
      logger.error('Failed to mark job as failed', { error, jobId });
      throw error;
    }
  }

  /**
   * Retry failed jobs
   * Resets status to PENDING for jobs with attempts < 3
   *
   * @returns Number of jobs retried
   */
  async retryFailedJobs(): Promise<number> {
    try {
      const result = await prisma.printJob.updateMany({
        where: {
          status: PrintStatus.FAILED,
          attempts: {
            lt: 3, // Max 3 attempts
          },
        },
        data: {
          status: PrintStatus.PENDING,
          lastError: null,
        },
      });

      logger.info('Retried failed print jobs', { count: result.count });

      return result.count;
    } catch (error) {
      logger.error('Failed to retry jobs', { error });
      throw error;
    }
  }

  /**
   * Retry a specific job manually
   *
   * @param jobId - Print job ID
   */
  async retryJob(jobId: string): Promise<void> {
    try {
      await prisma.printJob.update({
        where: { id: jobId },
        data: {
          status: PrintStatus.PENDING,
          lastError: null,
        },
      });

      logger.info('Print job manually retried', { jobId });
    } catch (error) {
      logger.error('Failed to retry job', { error, jobId });
      throw error;
    }
  }

  /**
   * Generate receipt data for a specific printer type
   * Filters items based on printer destination
   *
   * @param order - Order with items
   * @param printerType - Printer type
   * @returns Receipt data
   */
  private generateReceiptData(order: OrderWithItems, printerType: PrinterType): ReceiptData {
    const relevantItems = this.getItemsForPrinter(order.orderItems, printerType);

    const items = relevantItems.map((item) => ({
      name: item.menuItem.name,
      quantity: item.quantity,
      modifiers: item.selectedModifiers.map((mod: { modifierName: string }) => mod.modifierName),
      specialInstructions: item.specialInstructions || undefined,
    }));

    return {
      orderNumber: order.orderNumber,
      orderTime: order.createdAt.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }),
      customerName: order.user.firstName || order.user.lastName
        ? `${order.user.firstName || ''} ${order.user.lastName || ''}`.trim()
        : order.user.email.split('@')[0],
      items,
      specialInstructions: order.specialInstructions ?? undefined,
    };
  }

  /**
   * Filter items for a specific printer type
   * Handles KITCHEN, BEVERAGE, and BOTH destinations
   *
   * @param items - Order items
   * @param printerType - Printer type
   * @returns Filtered items
   */
  private getItemsForPrinter(items: any[], printerType: PrinterType): any[] {
    return items.filter((item) => {
      const destination = item.menuItem.printerDestination;

      if (destination === 'BOTH') {
        return true;
      }

      return destination === printerType;
    });
  }

  /**
   * Get print job statistics
   *
   * @returns Job statistics
   */
  async getJobStatistics(): Promise<{
    pending: number;
    sent: number;
    printed: number;
    failed: number;
  }> {
    try {
      const [pending, sent, printed, failed] = await Promise.all([
        prisma.printJob.count({ where: { status: PrintStatus.PENDING } }),
        prisma.printJob.count({ where: { status: PrintStatus.SENT } }),
        prisma.printJob.count({ where: { status: PrintStatus.PRINTED } }),
        prisma.printJob.count({ where: { status: PrintStatus.FAILED } }),
      ]);

      return { pending, sent, printed, failed };
    } catch (error) {
      logger.error('Failed to get job statistics', { error });
      throw error;
    }
  }

  /**
   * Clean up old printed jobs
   * Deletes jobs older than specified days
   *
   * @param daysOld - Number of days
   * @returns Number of deleted jobs
   */
  async cleanupOldJobs(daysOld: number = 7): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await prisma.printJob.deleteMany({
        where: {
          status: PrintStatus.PRINTED,
          printedAt: {
            lt: cutoffDate,
          },
        },
      });

      logger.info('Cleaned up old print jobs', { count: result.count, daysOld });

      return result.count;
    } catch (error) {
      logger.error('Failed to cleanup old jobs', { error });
      throw error;
    }
  }
}

// Export singleton instance
export default new PrintService();
