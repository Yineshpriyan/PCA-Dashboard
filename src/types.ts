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

export const DISTRICT_NUMBERS: Record<string, string> = {
  'Colombo': '01',
  'Gampaha': '02',
  'Kalutara': '03',
  'Kandy': '04',
  'Matale': '05',
  'Nuwara Eliya': '06',
  'Galle': '07',
  'Matara': '08',
  'Matara ': '08',
  'Hambantota': '09',
  'Jaffna': '10',
  'Kilinochchi': '11',
  'Mannar': '12',
  'Vavuniya': '13',
  'Mullaitivu': '14',
  'Batticaloa': '15',
  'Ampara': '16',
  'Trincomalee': '17',
  'Kurunegala': '18',
  'Puttalam': '19',
  'Anuradhapura': '20',
  'Polonnaruwa': '21',
  'Badulla': '22',
  'Moneragala': '23',
  'Monaragala': '23',
  'Ratnapura': '24',
  'Kegalle': '25'
};

export interface User {
  id: string;
  username: string;
  email?: string;
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
  last_name?: string | null;
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
  dob?: string | null;
  created_at: string;
  deleted_at?: string | null;
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
  dob?: string | null;
  created_at: string;
}

export interface Student {
  id: string;
  pcaid: string;
  name: string;
  last_name?: string | null;
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
  nic?: string | null;
  dob?: string | null;
  father_job?: string | null;
  mother_job?: string | null;
  status?: string;
  updated_at?: string;
  deleted_at?: string | null;
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
  deleted_at?: string | null;
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

export interface AppFolder {
  id: string;
  name: string;
  description?: string;
  parent_id: string | null;
  created_at: string;
  is_active: boolean;
  order_index?: number;
  payment_type?: 'Free' | 'Paid';
  price?: number | null;
}

export interface AppResource {
  id: string;
  folder_id: string;
  title: string;
  type: 'video' | 'pdf' | 'link' | 'note';
  url: string;
  duration?: string;
  file_size?: string;
  description?: string;
  created_at: string;
}

export interface StudentFolderAccess {
  id: string;
  student_pcaid: string;
  folder_id: string;
  is_enabled: boolean;
  expires_at?: string | null;
  duration_preset?: string | null;
  updated_at: string;
}

export interface StudentAppCredentials {
  id: string;
  pcaid: string;
  student_name?: string | null;
  name?: string | null;
  password_hash?: string | null;
  status: 'Active' | 'Inactive';
  profile_picture_url?: string | null;
  last_login_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type NotificationDisplayType = 'banner' | 'push_bar';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  display_type: NotificationDisplayType;
  image_url?: string | null;
  action_url?: string | null;
  target_batch?: string | null;
  is_active: boolean;
  scheduled_at?: string | null;
  expires_at?: string | null;
  clicks_count?: number;
  views_count?: number;
  created_at: string;
  updated_at?: string;
}


