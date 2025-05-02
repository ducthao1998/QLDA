import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
export function formatDuration(hours: number): string {
  const HOURS_IN_DAY = 8
  const DAYS_IN_WEEK = 5
  const WEEKS_IN_MONTH = 4
  const MONTHS_IN_YEAR = 12

  const HOURS_IN_WEEK = HOURS_IN_DAY * DAYS_IN_WEEK
  const HOURS_IN_MONTH = HOURS_IN_WEEK * WEEKS_IN_MONTH
  const HOURS_IN_YEAR = HOURS_IN_MONTH * MONTHS_IN_YEAR

  if (hours >= HOURS_IN_YEAR) {
    return `${(hours / HOURS_IN_YEAR).toFixed(1)} năm`
  } else if (hours >= HOURS_IN_MONTH) {
    return `${(hours / HOURS_IN_MONTH).toFixed(1)} tháng`
  } else if (hours >= HOURS_IN_WEEK) {
    return `${(hours / HOURS_IN_WEEK).toFixed(1)} tuần`
  } else if (hours >= HOURS_IN_DAY) {
    return `${(hours / HOURS_IN_DAY).toFixed(1)} ngày`
  } else {
    return `${hours.toFixed(1)} giờ`
  }
}