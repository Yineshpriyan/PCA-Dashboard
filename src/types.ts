export type AdminType = 'admin' | 'super_admin';
export type IssueStatus = 'Pending' | 'Progress' | 'Done';
export type CallStatus = 'Pending' | 'No Answer' | 'Completed';
export type LeadStatus = 'Not Sure' | 'Joined' | 'Not Join' | 'Free';

export const SRI_LANKAN_DISTRICTS = [
  'Colombo', 'Gampaha', 'Kalutara', 'Kandy', 'Matale', 'Nuwara Eliya', 
  'Galle', 'Matara', 'Hambantota', 'Jaffna', 'Kilinochchi', 'Mannar', 
  'Vavuniya', 'Mullaitivu', 'Batticaloa', 'Ampara', 'Trincomalee', 
  'Kurunegala', 'Puttalam', 'Anuradhapura', 'Polonnaruwa', 'Badulla', 
  'Moneragala', 'Ratnapura', 'Kegalle'
];

export interface User {
  id: string;
  username: string;
  password?: string;
  admin_type: AdminType;
  joined_date: string;
}

export interface Issue {
  id: string;
  issue: string;
  phone: string;
  pcaid: string;
  name: string;
  admin: string;
  date: string;
  fixed_date: string | null;
  status: IssueStatus;
  note?: string | null;
}

export interface CallTask {
  id: string;
  pcaid: string;
  name: string;
  proper_batch: string;
  joined_batch: string;
  school: string;
  district: string;
  mail: string;
  phone: string;
  address: string;
  asked_class_type: string;
  asked_package_type: string;
  admin: string;
  first_call_status: CallStatus;
  first_call_date: string | null;
  second_call_status: CallStatus;
  second_call_date: string | null;
  third_call_status: CallStatus;
  third_call_date: string | null;
  note: string;
  status: LeadStatus;
  stream?: string;
  created_at: string;
}

export interface FreeClassStudent {
  id: string;
  pcaid: string;
  name: string;
  proper_batch: string;
  joined_batch: string;
  school: string;
  district: string;
  mail: string;
  phone: string;
  address: string;
  asked_class_type: string;
  admin: string;
  stream?: string;
  created_at: string;
}

export interface Student {
  id: string;
  pcaid: string;
  name: string;
  proper_batch: string;
  joined_batch: string;
  school: string;
  district: string;
  mail: string;
  phone: string;
  address: string;
  asked_class_type: string;
  asked_package_type: string;
  admin: string;
  stream?: string;
  created_at: string;
  batch_type?: string;
  gender?: string;
}

export interface Payment {
  id: string;
  pcaid: string;
  type: 'class' | 'package';
  class_type?: string;
  package_type?: string;
  payment: number;
  paid_date: string;
  activation_date: string;
  duration: string;
  expired_date: string;
  total_amount?: number;
  installments?: any[];
}

export interface IssueType {
  id: string;
  issue_type: string;
}

export interface ClassItem {
  id: string;
  class_type: string;
}

export interface PackageItem {
  id: string;
  package_type: string;
}

export interface JoinedBatchItem {
  id: string;
  joined_batch: string;
}

export interface AuthSession {
  user: User;
}

export interface TransactionLog {
  id: string;
  admin_username: string;
  action_type: string;
  entity_type: string;
  entity_id?: string | null;
  details: string;
  created_at: string;
}

