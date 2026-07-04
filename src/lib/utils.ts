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

export function exportToExcel(data: any[], fileName: string) {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
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
