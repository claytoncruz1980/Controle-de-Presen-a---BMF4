/**
 * Centralized Attendance Helpers
 * Ensures 100% consistent presence, late, excused, and absence calculations
 * across all components (Telão, ReportsView, exportExcel, LabContext).
 */

export function normalizeStudentRa(ra: string | undefined | null): string {
  if (!ra) return '';
  return String(ra).trim().replace(/\D/g, '');
}

export function matchStudentRa(ra1: string | undefined | null, ra2: string | undefined | null): boolean {
  if (!ra1 || !ra2) return false;
  const clean1 = normalizeStudentRa(ra1);
  const clean2 = normalizeStudentRa(ra2);
  if (!clean1 || !clean2) return false;
  if (clean1 === clean2) return true;
  // Handle leading zeros or prefix variations
  const num1 = clean1.replace(/^0+/, '');
  const num2 = clean2.replace(/^0+/, '');
  if (num1 && num2 && num1 === num2) return true;
  return clean1.endsWith(clean2) || clean2.endsWith(clean1);
}

/**
 * Searches an attendance dictionary for a student's record using:
 * 1. Direct key by student ID
 * 2. Direct key by student RA
 * 3. Direct key by normalized numeric RA
 * 4. Value search by studentId, studentRa, or registrationNumber
 */
export function getStudentAttendanceRecord(
  attendance: Record<string, any> | undefined | null,
  student: { id?: string; registrationNumber?: string } | string | undefined | null
): any {
  if (!attendance || !student) return null;

  const studentId = typeof student === 'string' ? student : student.id;
  const studentRa = typeof student === 'string' ? '' : student.registrationNumber;
  const cleanRa = normalizeStudentRa(studentRa);

  // 1. Direct key match by ID
  if (studentId && attendance[studentId]) {
    return attendance[studentId];
  }

  // 2. Direct key match by raw RA
  if (studentRa && attendance[studentRa]) {
    return attendance[studentRa];
  }

  // 3. Direct key match by normalized RA
  if (cleanRa && attendance[cleanRa]) {
    return attendance[cleanRa];
  }

  // 4. Scan record objects inside attendance
  const records = Object.values(attendance);
  const matched = records.find((rec: any) => {
    if (!rec) return false;

    // Match by ID
    if (studentId && (rec.studentId === studentId || rec.id === studentId)) {
      return true;
    }

    // Match by RA
    if (cleanRa) {
      const recRa = rec.studentRa || rec.registrationNumber || rec.ra;
      if (matchStudentRa(recRa, cleanRa)) {
        return true;
      }
    }

    return false;
  });

  return matched || null;
}

/**
 * Checks if a record counts as "present".
 * Considers overall status, period 1, period 2, or sub-period presence.
 */
export function isRecordPresent(rec: any): boolean {
  if (!rec) return false;
  return (
    rec.status === 'present' ||
    rec.period1Status === 'present' ||
    rec.period2Status === 'present' ||
    rec.p1StartStatus === 'present' ||
    rec.p1EndStatus === 'present' ||
    rec.p2StartStatus === 'present' ||
    rec.p2EndStatus === 'present'
  );
}

/**
 * Checks if a record counts as "late".
 */
export function isRecordLate(rec: any): boolean {
  if (!rec) return false;
  return (
    rec.status === 'late' ||
    rec.period1Status === 'late' ||
    rec.period2Status === 'late' ||
    rec.p1StartStatus === 'late' ||
    rec.p2StartStatus === 'late'
  );
}

/**
 * Checks if a record counts as "excused" (medical certificate/atestado).
 */
export function isRecordExcused(rec: any): boolean {
  if (!rec) return false;
  return (
    rec.status === 'excused' ||
    rec.period1Status === 'excused' ||
    rec.period2Status === 'excused'
  );
}

/**
 * Checks if a record is definitely absent.
 */
export function isRecordAbsent(rec: any): boolean {
  if (!rec) return true;
  return !isRecordPresent(rec) && !isRecordLate(rec) && !isRecordExcused(rec);
}

/**
 * Determines consolidated status: 'present' | 'late' | 'excused' | 'absent'
 */
export function getRecordConsolidatedStatus(rec: any): 'present' | 'late' | 'excused' | 'absent' {
  if (!rec) return 'absent';
  if (isRecordPresent(rec)) return 'present';
  if (isRecordLate(rec)) return 'late';
  if (isRecordExcused(rec)) return 'excused';
  return 'absent';
}

/**
 * Returns human-readable label in Portuguese.
 */
export function getRecordStatusLabel(rec: any): string {
  const status = getRecordConsolidatedStatus(rec);
  switch (status) {
    case 'present': return 'Presente';
    case 'late': return 'Atraso';
    case 'excused': return 'Justificada';
    case 'absent': return 'Falta';
  }
}
