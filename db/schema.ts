import {sqliteTable,text,index} from 'drizzle-orm/sqlite-core';
export const shopperState=sqliteTable('shopper_state',{userId:text('user_id').primaryKey(),state:text('state').notNull(),updatedAt:text('updated_at').notNull()});
export const requests=sqliteTable('requests',{id:text('id').primaryKey(),userId:text('user_id').notNull(),kind:text('kind').notNull(),status:text('status').notNull(),payload:text('payload').notNull(),createdAt:text('created_at').notNull()},t=>[index('requests_user_date').on(t.userId,t.createdAt)]);
