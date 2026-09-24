export const STAFF_REQUEST_STATUSES = ['new', 'in-review', 'awaiting-customer', 'quoted', 'closed'] as const;
export type StaffRequestStatus = typeof STAFF_REQUEST_STATUSES[number];
export type RequestStatus = StaffRequestStatus | 'saved-preview';

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  'saved-preview': 'Saved enquiry',
  new: 'New',
  'in-review': 'In review',
  'awaiting-customer': 'Awaiting customer',
  quoted: 'Quote prepared',
  closed: 'Closed',
};
export const REQUEST_KIND_LABELS: Record<string, string> = {
  'order-quote': 'Order quotation', design: 'Design consultation', trade: 'Business enquiry',
  supplier: 'Supplier application', support: 'Support request', return: 'Return enquiry',
  'price-alert': 'Availability enquiry', newsletter: 'Launch updates', 'special-request': 'Product request',
};
export function requestStatusLabel(status: string) {
  return REQUEST_STATUS_LABELS[status as RequestStatus] || 'Saved enquiry';
}
export function requestKindLabel(kind: string) {
  return REQUEST_KIND_LABELS[kind] || 'Enquiry';
}

// Quote every field and neutralize spreadsheet formulas, including leading whitespace.
export function csvCell(value: unknown) {
  const text = value == null ? '' : String(value);
  const safe = /^[\s\u0000-\u001f]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text) ? "'" + text : text;
  return '"' + safe.replace(/"/g, '""') + '"';
}
