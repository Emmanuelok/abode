import {z} from 'zod';
import {productById} from './catalog';
import {departments} from './taxonomy';
const productId=z.string().max(100).refine(id=>!!productById(id),'Unknown product');
const idList=(max:number)=>z.array(productId).max(max).transform(ids=>[...new Set(ids)]);
export const stateFields={
 cart:z.array(z.object({id:productId,quantity:z.number().int().min(1).max(99)})).max(100).refine(lines=>new Set(lines.map(l=>l.id)).size===lines.length,'Duplicate cart item'),
 wishlist:idList(150),compare:idList(4),recent:idList(30),city:z.string().trim().min(1).max(80),
 profile:z.object({name:z.string().max(120),email:z.string().max(254).refine(v=>!v||/^\S+@\S+\.\S+$/.test(v),'Invalid email'),phone:z.string().max(40),address:z.string().max(1000),gps:z.string().max(25)}),
 registry:z.object({name:z.string().trim().min(1).max(120),date:z.string().max(10),items:idList(150)}),
 plans:z.array(z.object({id:z.string().min(1).max(100),name:z.string().trim().min(1).max(80),room:z.string().refine(r=>departments.some(d=>d.slug===r)),budget:z.number().finite().positive().max(100000000),width:z.number().finite().positive().max(100),length:z.number().finite().positive().max(100),products:idList(20),positions:z.record(z.object({x:z.number().finite().min(0).max(85),y:z.number().finite().min(0).max(85),rotation:z.number().finite()})).optional()})).max(30)
};
