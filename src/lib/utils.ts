import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import * as XLSX from 'xlsx';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string | null) {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function copyToClipboard(text: string, label: string = 'Content') {
  navigator.clipboard.writeText(text);
  return `${label} copied to clipboard!`;
}

// Clean and format student name for Zoom Webinar registrations & Database Entry
// Strips leading and trailing initials (e.g. "V. Bavana" -> "Bavana", "r. sutha" -> "Sutha", "K. M. Dinesh" -> "Dinesh"), brackets, and formats proper title case
export function cleanStudentNameForZoom(rawName: string): string {
  if (!rawName) return '';
  let cleaned = rawName.trim();

  // 1. Remove bracketed notes like (Bio), (Repeat)
  cleaned = cleaned.replace(/\(.*?\)/g, '').trim();

  // 2. Remove leading initials:
  // Matches single letter followed by dot/optional space (e.g. "V. ", "V.", "K.M.", "r.") OR single letter followed by whitespace (e.g. "V Bavana", "k m dinesh")
  cleaned = cleaned.replace(/^([a-zA-Z]\.(?:\s*)|[a-zA-Z]\s+)+/i, '').trim();

  // 3. Remove trailing initials: e.g. "Bavana V." or "Bavana V"
  cleaned = cleaned.replace(/(\s+[a-zA-Z]\.?)+$/i, '').trim();

  // 4. Fallback if everything was removed (e.g. name was literally just initials like "A.B.")
  if (cleaned.length < 2) {
    cleaned = rawName.replace(/\(.*?\)/g, '').trim();
  }

  // 5. Proper Title Case Capitalization (e.g. "sutha" -> "Sutha", "chamara perera" -> "Chamara Perera")
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return rawName.trim() || '';

  return words
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function exportToExcel(data: any[], fileName: string) {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

/**
 * Parses user email input and strips accidental duplicated domains (e.g. "@gmail.com", "@icloud.com", "gmail.com", "icloud.com").
 * Automatically identifies if the user typed or pasted an @icloud.com or @gmail.com address.
 */
export function parseEmailUsernameAndDomain(
  rawInput: string,
  fallbackDomain: string = '@gmail.com'
): { username: string; domain: string } {
  if (!rawInput) return { username: '', domain: fallbackDomain };
  let val = rawInput.trim();
  let detectedDomain = fallbackDomain;

  // 1. Detect if the user explicitly typed/pasted an iCloud or Gmail domain
  if (/@icloud(\.com)?/i.test(val) || /icloud\.com$/i.test(val)) {
    detectedDomain = '@icloud.com';
  } else if (/@gmail(\.com)?/i.test(val) || /@googlemail(\.com)?/i.test(val) || /gmail\.com$/i.test(val)) {
    detectedDomain = '@gmail.com';
  }

  // 2. If input contains '@', extract the username part before the first '@'
  if (val.includes('@')) {
    val = val.split('@')[0];
  }

  // 3. Strip trailing accidental domains if typed without '@' (e.g. "mynamegmail.com" or "nameicloud.com")
  val = val.replace(/(gmail|icloud|googlemail)\.com$/gi, '');
  val = val.replace(/(gmail|icloud|googlemail)$/gi, '');

  // 4. Clean all characters leaving only valid email username characters: a-z, A-Z, 0-9, ., _, -
  const cleanUsername = val.replace(/[^a-zA-Z0-9._-]/g, '');

  return { username: cleanUsername, domain: detectedDomain };
}

/**
 * Returns a fully formatted clean email like "username@gmail.com" or "username@icloud.com",
 * guaranteed to never contain duplicated suffixes like "@gmail.com@gmail.com".
 */
export function formatCleanEmail(rawInput: string, currentDomain: string = '@gmail.com'): string {
  if (!rawInput || !rawInput.trim()) return '';
  const { username, domain } = parseEmailUsernameAndDomain(rawInput, currentDomain);
  if (!username) return '';
  return `${username}${domain}`;
}


export async function playNotificationSound() {
  try {
    const context = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    if (context.state === 'suspended') {
      await context.resume();
    }

    const osc = context.createOscillator();
    const gain = context.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, context.currentTime); // A5
    osc.frequency.exponentialRampToValueAtTime(440, context.currentTime + 0.5); // A4

    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.linearRampToValueAtTime(0.2, context.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(context.destination);

    osc.start();
    osc.stop(context.currentTime + 0.5);
  } catch (err) {
    console.warn('Audio notification failed:', err);
  }
}
