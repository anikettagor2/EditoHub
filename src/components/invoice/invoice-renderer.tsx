import { Invoice } from "@/types/schema";
import { format } from "date-fns";

interface InvoiceRendererProps {
    invoice: Invoice;
}

export function InvoiceRenderer({ invoice }: InvoiceRendererProps) {
    return (
        <div id="invoice-print-area" className="bg-white text-black p-10 max-w-[210mm] mx-auto min-h-[297mm] relative shadow-lg print:shadow-none print:p-0 print:m-0 print:w-full print:h-auto print:max-w-none">
            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-zinc-100 pb-8 mb-8">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight text-zinc-900">INVOICE</h1>
                    <p className="text-zinc-500 mt-1">#{invoice.invoiceNumber}</p>
                </div>
                <div className="text-right">
                    <h2 className="text-xl font-bold text-zinc-900">EditoHub Agency</h2>
                    <p className="text-sm text-zinc-500">123 Creative Studio Blvd</p>
                    <p className="text-sm text-zinc-500">Los Angeles, CA 90012</p>
                    <p className="text-sm text-zinc-500">billing@editohub.com</p>
                </div>
            </div>

            {/* Bill To & Details */}
            <div className="flex justify-between mb-12">
                <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">Bill To</h3>
                    <p className="font-bold text-lg">{invoice.clientName}</p>
                    <p className="text-zinc-600">{invoice.clientEmail}</p>
                    {invoice.clientAddress && (
                        <p className="text-zinc-600 whitespace-pre-line">{invoice.clientAddress}</p>
                    )}
                </div>
                <div className="text-right">
                    <div className="mb-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">Issue Date</h3>
                        <p className="font-medium">{format(invoice.issueDate, "MMM dd, yyyy")}</p>
                    </div>
                    <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">Due Date</h3>
                        <p className="font-medium">{format(invoice.dueDate, "MMM dd, yyyy")}</p>
                    </div>
                </div>
            </div>

            {/* Items Table */}
            <table className="w-full mb-12">
                <thead>
                    <tr className="border-b border-zinc-200">
                        <th className="text-left py-3 text-xs font-bold uppercase tracking-wider text-zinc-400">Description</th>
                        <th className="text-right py-3 text-xs font-bold uppercase tracking-wider text-zinc-400">Qty</th>
                        <th className="text-right py-3 text-xs font-bold uppercase tracking-wider text-zinc-400">Rate</th>
                        <th className="text-right py-3 text-xs font-bold uppercase tracking-wider text-zinc-400">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {invoice.items.map((item, index) => (
                        <tr key={index} className="border-b border-zinc-100 last:border-0">
                            <td className="py-4 text-zinc-700 font-medium">{item.description}</td>
                            <td className="py-4 text-right text-zinc-500">{item.quantity}</td>
                            <td className="py-4 text-right text-zinc-500">${item.rate.toLocaleString()}</td>
                            <td className="py-4 text-right text-zinc-900 font-bold">${item.amount.toLocaleString()}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end mb-12">
                <div className="w-1/2 md:w-1/3 space-y-3">
                    <div className="flex justify-between text-zinc-500">
                        <span>Subtotal</span>
                        <span>${invoice.subtotal.toLocaleString()}</span>
                    </div>
                    {invoice.tax && invoice.tax > 0 && (
                        <div className="flex justify-between text-zinc-500">
                            <span>Tax</span>
                            <span>${((invoice.subtotal * invoice.tax) / 100).toLocaleString()}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-xl font-bold text-zinc-900 border-t-2 border-zinc-100 pt-3">
                        <span>Total Due</span>
                        <span>${invoice.total.toLocaleString()}</span>
                    </div>
                </div>
            </div>

            {/* Notes */}
            {invoice.notes && (
                <div className="bg-zinc-50 p-6 rounded-lg mb-8 print:bg-transparent print:p-0 print:border-t print:border-zinc-200 print:rounded-none">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">Notes</h3>
                    <p className="text-zinc-600 text-sm whitespace-pre-wrap">{invoice.notes}</p>
                </div>
            )}

            {/* Footer */}
            <div className="absolute bottom-10 left-10 right-10 text-center text-xs text-zinc-400 print:bottom-0">
                <p>Thank you for your business. Please contact billing@editohub.com for any questions.</p>
            </div>
        </div>
    );
}
