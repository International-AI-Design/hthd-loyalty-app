import { Router, Request, Response } from 'express';
import { authenticateCustomer, AuthenticatedCustomerRequest } from '../../middleware/auth';
import { loadFundsSchema, autoReloadSchema } from './types';
import { WalletService, WalletError } from './service';

const router = Router();
const walletService = new WalletService();

// All wallet routes require customer authentication
router.use(authenticateCustomer);

// GET / — get my wallet
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { customer } = req as AuthenticatedCustomerRequest;
    const wallet = await walletService.getOrCreateWallet(customer.id);

    res.json({
      id: wallet.id,
      balance_cents: wallet.balanceCents,
      tier: wallet.tier,
      auto_reload: {
        enabled: wallet.autoReloadEnabled,
        threshold_cents: wallet.autoReloadThresholdCents,
        reload_amount_cents: wallet.autoReloadAmountCents,
      },
    });
  } catch (error) {
    handleError(res, error);
  }
});

// POST /load — load funds into wallet
router.post('/load', async (req: Request, res: Response): Promise<void> => {
  try {
    const { customer } = req as AuthenticatedCustomerRequest;

    const validation = loadFundsSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation error', details: validation.error.issues });
      return;
    }

    const { wallet, transaction } = await walletService.loadFunds(
      customer.id,
      validation.data.amount_cents
    );

    res.json({
      success: true,
      wallet: {
        balance_cents: wallet.balanceCents,
        tier: wallet.tier,
      },
      transaction: {
        id: transaction.id,
        type: transaction.type,
        amount_cents: transaction.amountCents,
        balance_after_cents: transaction.balanceAfterCents,
        created_at: transaction.createdAt,
      },
    });
  } catch (error) {
    handleError(res, error);
  }
});

// GET /transactions — paginated transaction history
router.get('/transactions', async (req: Request, res: Response): Promise<void> => {
  try {
    const { customer } = req as AuthenticatedCustomerRequest;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const { transactions, total } = await walletService.getTransactionHistory(customer.id, {
      limit,
      offset,
    });

    res.json({
      transactions: transactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount_cents: t.amountCents,
        balance_after_cents: t.balanceAfterCents,
        description: t.description,
        booking_id: t.bookingId,
        created_at: t.createdAt,
      })),
      total,
      limit,
      offset,
    });
  } catch (error) {
    handleError(res, error);
  }
});

// PUT /auto-reload — configure auto-reload settings
router.put('/auto-reload', async (req: Request, res: Response): Promise<void> => {
  try {
    const { customer } = req as AuthenticatedCustomerRequest;

    const validation = autoReloadSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation error', details: validation.error.issues });
      return;
    }

    const wallet = await walletService.setAutoReload(customer.id, validation.data);

    res.json({
      success: true,
      auto_reload: {
        enabled: wallet.autoReloadEnabled,
        threshold_cents: wallet.autoReloadThresholdCents,
        reload_amount_cents: wallet.autoReloadAmountCents,
      },
    });
  } catch (error) {
    handleError(res, error);
  }
});

// GET /balance — lightweight balance check
router.get('/balance', async (req: Request, res: Response): Promise<void> => {
  try {
    const { customer } = req as AuthenticatedCustomerRequest;
    const { balanceCents, tier } = await walletService.getBalance(customer.id);

    res.json({ balance_cents: balanceCents, tier });
  } catch (error) {
    handleError(res, error);
  }
});

function handleError(res: Response, error: unknown): void {
  if (error instanceof WalletError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  console.error('Wallet error:', error);
  res.status(500).json({ error: 'Internal server error' });
}

export default router;
