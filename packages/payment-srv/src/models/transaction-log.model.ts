import mongoose, { InferSchemaType } from 'mongoose';

const transactionLogSchema = new mongoose.Schema(
  {
    paymentId: { type: String, required: true, index: true },
    event: { type: String, required: true },
    fromStatus: { type: String },
    toStatus: { type: String },
    pspName: { type: String },
    request: { type: mongoose.Schema.Types.Mixed },
    response: { type: mongoose.Schema.Types.Mixed },
    error: { type: String },
    durationMs: { type: Number },
    correlationId: { type: String, required: true },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  {
    collection: 'transaction_logs',
    versionKey: false,
  },
);

export type TransactionLogDocument = InferSchemaType<typeof transactionLogSchema>;

export const TransactionLogModel = mongoose.model('TransactionLog', transactionLogSchema);
