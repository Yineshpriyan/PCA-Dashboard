import { supabase } from './supabase';

export type LogActionType = 'CREATE' | 'UPDATE' | 'DELETE' | 'RESOLVE' | 'LOGIN' | 'LOGOUT' | 'PAYMENT_ADD' | 'ADD_OPTION';
export type LogEntityType = 'student' | 'free_class' | 'calltask' | 'issue' | 'payment' | 'admin' | 'settings';

interface LogParams {
  admin_username: string;
  action_type: LogActionType | string;
  entity_type: LogEntityType | string;
  entity_id?: string | null;
  details: string;
}

export async function logTransaction(params: LogParams): Promise<void> {
  try {
    const { error } = await supabase
      .from('transaction_log')
      .insert({
        admin_username: params.admin_username,
        action_type: params.action_type,
        entity_type: params.entity_type,
        entity_id: params.entity_id || null,
        details: params.details,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.warn('Supabase transaction logging warning (table might not exist yet):', error.message);
    }
  } catch (err) {
    console.warn('Error saving transaction log:', err);
  }
}
