import type { EstimatedTimeResult } from "@/app/types/task"
import { differenceInDays, differenceInHours } from "date-fns"

interface EstimatedTimeParams {
  start_date?: string
  end_date?: string
  max_retries?: number
  dependencies?: any[]
}

export function calculateEstimatedTime(params: EstimatedTimeParams): EstimatedTimeResult {
  const { start_date, end_date, max_retries = 0, dependencies = [] } = params

  console.log("Input params:", { start_date, end_date, max_retries, dependencies })

  // Tính toán thời gian dựa trên ngày bắt đầu và kết thúc
  let baseEstimate = 0

  if (start_date && end_date) {
    const startDate = new Date(start_date)
    const endDate = new Date(end_date)

    console.log("Parsed dates:", { startDate, endDate })

    // Tính số ngày làm việc (không tính cuối tuần)
    const totalDays = differenceInDays(endDate, startDate)
    const workingDays = Math.ceil(totalDays * 5/7) // Giả định 5 ngày làm việc mỗi tuần

    console.log("Day calculations:", { totalDays, workingDays })

    // Tính số giờ làm việc (8 giờ mỗi ngày)
    baseEstimate = workingDays * 8

    console.log("Base estimate (hours):", baseEstimate)
  } else {
    console.log("Missing start_date or end_date")
    baseEstimate = 0
  }

  // Add time for retries (each retry adds 10%)
  const retryFactor = 1 + max_retries * 0.1

  // Add time for dependencies (each dependency adds 5%)
  const dependencyFactor = 1 + dependencies.length * 0.05

  console.log("Factors:", { retryFactor, dependencyFactor })

  // Calculate final estimate in hours
  const estimatedHours = baseEstimate * retryFactor * dependencyFactor

  console.log("Final estimated hours:", estimatedHours)

  // Calculate confidence (0-1)
  const dependencyConfidence = Math.max(0.5, 1 - dependencies.length * 0.05)

  // Final confidence
  const confidence = Math.max(0.3, dependencyConfidence)

  // Convert to appropriate time unit
  const { displayTime, timeUnit, details } = convertToAppropriateTimeUnit(estimatedHours)

  console.log("Final result:", { estimatedHours, displayTime, timeUnit, confidence })

  return {
    estimatedTime: estimatedHours,
    displayTime,
    timeUnit,
    confidence,
    details,
  }
}

function convertToAppropriateTimeUnit(hours: number): {
  displayTime: number
  timeUnit: "hour" | "day" | "week" | "month" | "year"
  details: {
    weeks: number
    days: number
    hours: number
  }
} {
  // Các ngưỡng chuyển đổi
  const HOURS_IN_DAY = 8 // Giờ làm việc trong ngày
  const DAYS_IN_WEEK = 5 // Ngày làm việc trong tuần
  const WEEKS_IN_MONTH = 4 // Tuần trong tháng
  const MONTHS_IN_YEAR = 12 // Tháng trong năm

  // Tính toán các ngưỡng
  const HOURS_IN_WEEK = HOURS_IN_DAY * DAYS_IN_WEEK
  const HOURS_IN_MONTH = HOURS_IN_WEEK * WEEKS_IN_MONTH
  const HOURS_IN_YEAR = HOURS_IN_MONTH * MONTHS_IN_YEAR

  // Tính toán chi tiết
  const weeks = Math.floor(hours / HOURS_IN_WEEK)
  const remainingHours = hours % HOURS_IN_WEEK
  const days = Math.floor(remainingHours / HOURS_IN_DAY)
  const remainingHoursInDay = remainingHours % HOURS_IN_DAY

  // Chọn đơn vị phù hợp
  let timeUnit: "hour" | "day" | "week" | "month" | "year"
  let displayTime: number

  if (hours >= HOURS_IN_YEAR) {
    timeUnit = "year"
    displayTime = Number.parseFloat((hours / HOURS_IN_YEAR).toFixed(1))
  } else if (hours >= HOURS_IN_MONTH) {
    timeUnit = "month"
    displayTime = Number.parseFloat((hours / HOURS_IN_MONTH).toFixed(1))
  } else if (hours >= HOURS_IN_WEEK) {
    timeUnit = "week"
    displayTime = Number.parseFloat((hours / HOURS_IN_WEEK).toFixed(1))
  } else if (hours >= HOURS_IN_DAY) {
    timeUnit = "day"
    displayTime = Number.parseFloat((hours / HOURS_IN_DAY).toFixed(1))
  } else {
    timeUnit = "hour"
    displayTime = Number.parseFloat(hours.toFixed(1))
  }

  return {
    displayTime,
    timeUnit,
    details: {
      weeks,
      days,
      hours: remainingHoursInDay
    }
  }
}
