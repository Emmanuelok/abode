import {z} from 'zod';
import {productById} from './catalog';

const email = z.string().trim().max(254, 'Please shorten your email address.').email('Enter a valid email address.');
const requiredText = (max: number, label: string) => z.string().trim().min(1, 'Enter ' + label + '.').max(max, 'Please shorten ' + label + '.');
const optionalText = (max: number) => z.string().trim().max(max, 'Please shorten this field.').optional().default('');
const optionalNumeric = (minimum: number, maximum: number, integer = false) => z.union([z.string().trim().max(24), z.number().finite()]).optional().default('').refine(value => value === '' || (Number.isFinite(Number(value)) && Number(value) >= minimum && Number(value) <= maximum && (!integer || Number.isInteger(Number(value)))), 'Enter a number within the permitted range.');
const website = optionalText(2048).refine(value => {if (!value) return true;try {const url = new URL(value);return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;} catch {return false;}}, 'Enter a website beginning with https:// or http://.');
const date = optionalText(10).refine(value => !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value), 'Enter a valid calendar date.');
const gps = optionalText(25).refine(value => !value || /^[A-Z]{2}-\d{3,4}-\d{4,5}$/i.test(value), 'Check the digital address format, e.g. GA-123-4567.');
const productId = z.string().min(1).max(100).refine(value => Boolean(productById(value)), 'Choose a valid catalogue item.');
const service = z.object({
  name: requiredText(120, 'your name'), email, phone: optionalText(40), city: requiredText(80, 'your city or town'),
  message: z.string().trim().min(10, 'Tell us a little more, using at least 10 characters.').max(5000, 'Keep your message under 5,000 characters.'),
  business: optionalText(160), category: optionalText(160), budget: optionalNumeric(0, 100000000),
  quantity: optionalNumeric(1, 100000, true), website, reference: optionalText(100), date,
});
const businessService = service.extend({business: requiredText(160, 'your business name')});
const quote = z.object({
  name: requiredText(120, 'your name'), email,
  phone: z.string().trim().max(40).refine(value => /^(?:\+233|0)\d{9}$/.test(value.replace(/[\s-]/g, '')), 'Enter a valid Ghana phone number.'),
  address: requiredText(1000, 'your delivery address'), gps, landmark: optionalText(300), region: optionalText(80), city: optionalText(80), access: optionalText(2000), notes: optionalText(5000),
  method: z.enum(['MTN MoMo', 'Telecel Cash', 'ATMoney', 'Visa / Mastercard', 'Bank transfer enquiry']).optional(),
  delivery: z.enum(['Standard delivery', 'Scheduled bulky-item delivery', 'Pickup enquiry']).optional(), assembly: z.boolean().optional().default(false),
  items: z.array(z.object({id: productId, quantity: z.number().int().min(1).max(99)})).min(1, 'Add an item to your bag.').max(100, 'Request up to 100 distinct pieces.').refine(items => new Set(items.map(item => item.id)).size === items.length, 'Combine repeated bag items into one quantity.'),
});

// Unknown keys are deliberately stripped. Role, price, payment and workflow
// fields cannot be supplied by a customer, even alongside a valid enquiry.
export const intakeSchema = z.discriminatedUnion('kind', [
  z.object({kind: z.literal('order-quote'), payload: quote}),
  z.object({kind: z.literal('design'), payload: service}),
  z.object({kind: z.literal('trade'), payload: businessService}),
  z.object({kind: z.literal('supplier'), payload: businessService}),
  z.object({kind: z.literal('support'), payload: service}),
  z.object({kind: z.literal('return'), payload: service}),
  z.object({kind: z.literal('special-request'), payload: service}),
  z.object({kind: z.literal('price-alert'), payload: z.object({email, productId, productName: optionalText(500)})}),
  z.object({kind: z.literal('newsletter'), payload: z.object({email})}),
]);

export function prepareIntake(input: unknown) {
  const data = intakeSchema.parse(input);
  if (data.kind === 'order-quote') {
    const items = data.payload.items.map(line => {const product = productById(line.id)!;return {id: product.id, name: product.name, quantity: line.quantity, guidePrice: product.price};});
    return {...data, payload: {...data.payload, items, guideSubtotal: items.reduce((sum, item) => sum + item.quantity * item.guidePrice, 0), paymentStatus: 'not-collected', pricing: 'illustrative'}};
  }
  if (data.kind === 'price-alert') return {...data, payload: {...data.payload, productName: productById(data.payload.productId)!.name}};
  return data;
}
