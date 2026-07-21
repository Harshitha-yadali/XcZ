\nALTER TABLE public.payment_transactions\nADD COLUMN wallet_deduction_amount INTEGER DEFAULT 0;
\n\n\nALTER TABLE public.payment_transactions\nADD CONSTRAINT check_wallet_deduction_non_negative CHECK (wallet_deduction_amount >= 0);
\n;
