import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import { 
  INITIAL_CLASSES, 
  INITIAL_STUDENTS, 
  INITIAL_SESSIONS, 
  INITIAL_JUSTIFICATIONS, 
  INITIAL_PROFESSORS,
  DEFAULT_SETTINGS,
  INITIAL_STUDENT_GRADES
} from "./src/data/initialData";

const PORT = 3000;
const DB_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "db.json");

interface ServerDatabase {
  professors: any[];
  activeProfessorId: string;
  classes: any[];
  students: any[];
  sessions: any[];
  deletedSessionIds?: string[];
  deletedProfessorIds?: string[];
  justifications: any[];
  studentGrades: any[];
  appSettings: any;
  lessonTitles: string[];
  selectedClassId: string;
  teacherPresences?: Record<string, any>;
  connectedDevices?: Record<string, any>;
  lastUpdated: number;
}

// Initial Database Factory
function getInitialDbState(): ServerDatabase {
  return {
    professors: INITIAL_PROFESSORS || [],
    activeProfessorId: INITIAL_PROFESSORS[0]?.id || "",
    classes: INITIAL_CLASSES || [],
    students: INITIAL_STUDENTS || [],
    sessions: INITIAL_SESSIONS || [],
    deletedSessionIds: [],
    deletedProfessorIds: [],
    justifications: INITIAL_JUSTIFICATIONS || [],
    studentGrades: INITIAL_STUDENT_GRADES || [],
    appSettings: DEFAULT_SETTINGS,
    lessonTitles: [],
    selectedClassId: INITIAL_CLASSES[0]?.id || "",
    teacherPresences: {},
    connectedDevices: {},
    lastUpdated: 1,
  };
}

// Load or Initialize DB
function loadDatabase(): ServerDatabase {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.students)) {
        let ts = Number(parsed.lastUpdated) || 1;
        if (ts > 4000000000000 || isNaN(ts)) {
          ts = 1;
        }
        return {
          ...getInitialDbState(),
          ...parsed,
          deletedSessionIds: Array.isArray(parsed.deletedSessionIds) ? parsed.deletedSessionIds : [],
          lastUpdated: ts,
        };
      }
    }
  } catch (err) {
    console.error("Error reading database file, initializing fallback:", err);
  }

  const initial = getInitialDbState();
  saveDatabase(initial);
  return initial;
}

let dbState: ServerDatabase = loadDatabase();

function saveDatabase(state: ServerDatabase) {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving database file:", err);
  }
}

function mergeAttendanceRecord(currentRec: any, incomingRec: any): any {
  if (!currentRec && !incomingRec) return null;
  if (!currentRec) return incomingRec;
  if (!incomingRec) return currentRec;

  return {
    ...currentRec,
    ...incomingRec,
    status: incomingRec.status !== undefined ? incomingRec.status : currentRec.status,
    period1Status: incomingRec.period1Status !== undefined ? incomingRec.period1Status : currentRec.period1Status,
    period2Status: incomingRec.period2Status !== undefined ? incomingRec.period2Status : currentRec.period2Status,
    p1StartStatus: incomingRec.p1StartStatus !== undefined ? incomingRec.p1StartStatus : currentRec.p1StartStatus,
    p1EndStatus: incomingRec.p1EndStatus !== undefined ? incomingRec.p1EndStatus : currentRec.p1EndStatus,
    p2StartStatus: incomingRec.p2StartStatus !== undefined ? incomingRec.p2StartStatus : currentRec.p2StartStatus,
    p2EndStatus: incomingRec.p2EndStatus !== undefined ? incomingRec.p2EndStatus : currentRec.p2EndStatus,
    p1StartTimestamp: incomingRec.p1StartTimestamp || currentRec.p1StartTimestamp,
    p1EndTimestamp: incomingRec.p1EndTimestamp || currentRec.p1EndTimestamp,
    p2StartTimestamp: incomingRec.p2StartTimestamp || currentRec.p2StartTimestamp,
    p2EndTimestamp: incomingRec.p2EndTimestamp || currentRec.p2EndTimestamp,
    period1Timestamp: incomingRec.period1Timestamp || currentRec.period1Timestamp,
    period2Timestamp: incomingRec.period2Timestamp || currentRec.period2Timestamp,
    timestamp: incomingRec.timestamp || currentRec.timestamp,
    epiVerified: incomingRec.epiVerified ?? currentRec.epiVerified ?? true,
    checkinMethod: incomingRec.checkinMethod || currentRec.checkinMethod || 'qrcode',
    deviceId: incomingRec.deviceId || currentRec.deviceId,
  };
}

function mergeSessions(
  currentSessions: any[], 
  incomingSessions: any[], 
  deletedIds: string[] = []
): any[] {
  const deletedSet = new Set(deletedIds || []);
  const resultMap = new Map<string, any>();

  // 1. Index current non-deleted sessions
  (currentSessions || []).forEach((s: any) => {
    if (s && s.id && !deletedSet.has(s.id)) {
      resultMap.set(s.id, { ...s });
    }
  });

  // 2. Merge incoming non-deleted sessions
  if (Array.isArray(incomingSessions)) {
    incomingSessions.forEach((inc: any) => {
      if (!inc || !inc.id || deletedSet.has(inc.id)) return;
      const existing = resultMap.get(inc.id);
      if (!existing) {
        resultMap.set(inc.id, { ...inc });
      } else {
        const mergedAttendance = { ...(existing.attendance || {}) };
        const incAttendance = inc.attendance || {};
        for (const [stId, incRec] of Object.entries(incAttendance)) {
          const merged = mergeAttendanceRecord(mergedAttendance[stId], incRec);
          if (merged) {
            mergedAttendance[stId] = merged;
          }
        }

        resultMap.set(inc.id, {
          ...existing,
          ...inc,
          attendance: mergedAttendance,
          isLive: inc.isLive !== undefined ? inc.isLive : existing.isLive,
          isLocked: inc.isLocked !== undefined ? inc.isLocked : existing.isLocked,
          isPaused: inc.isPaused !== undefined ? inc.isPaused : existing.isPaused,
          activePeriod: inc.activePeriod || existing.activePeriod,
          isPeriod1Locked: inc.isPeriod1Locked ?? existing.isPeriod1Locked,
          isPeriod2Locked: inc.isPeriod2Locked ?? existing.isPeriod2Locked,
          coProfessors: Array.isArray(inc.coProfessors) ? inc.coProfessors : existing.coProfessors,
        });
      }
    });
  }

  return Array.from(resultMap.values());
}

function mergeStudents(currentStudents: any[], incomingStudents: any[]): any[] {
  if (!Array.isArray(incomingStudents) || incomingStudents.length === 0) {
    return currentStudents || [];
  }
  const resultMap = new Map<string, any>();
  (currentStudents || []).forEach((st: any) => {
    if (st && st.id) resultMap.set(st.id, { ...st });
  });

  incomingStudents.forEach((inc: any) => {
    if (!inc || !inc.id) return;
    const existing = resultMap.get(inc.id);
    if (!existing) {
      resultMap.set(inc.id, { ...inc });
    } else {
      resultMap.set(inc.id, {
        ...existing,
        ...inc,
      });
    }
  });

  return Array.from(resultMap.values());
}

function mergeClasses(currentClasses: any[], incomingClasses: any[]): any[] {
  if (!Array.isArray(incomingClasses) || incomingClasses.length === 0) {
    return currentClasses || [];
  }
  const resultMap = new Map<string, any>();
  (currentClasses || []).forEach((c: any) => {
    if (c && c.id) resultMap.set(c.id, { ...c });
  });

  incomingClasses.forEach((inc: any) => {
    if (!inc || !inc.id) return;
    const existing = resultMap.get(inc.id);
    if (!existing) {
      resultMap.set(inc.id, { ...inc });
    } else {
      resultMap.set(inc.id, { ...existing, ...inc });
    }
  });

  return Array.from(resultMap.values());
}

function mergeProfessors(currentProfessors: any[], incomingProfessors: any[], deletedIds: string[] = []): any[] {
  if (!Array.isArray(incomingProfessors) || incomingProfessors.length === 0) {
    const deletedSet = new Set(deletedIds);
    return (currentProfessors || []).filter((p: any) => p && p.id && !deletedSet.has(p.id));
  }
  const deletedSet = new Set(deletedIds);
  const resultMap = new Map<string, any>();
  (currentProfessors || []).forEach((p: any) => {
    if (p && p.id && !deletedSet.has(p.id)) resultMap.set(p.id, { ...p });
  });

  incomingProfessors.forEach((inc: any) => {
    if (!inc || !inc.id || deletedSet.has(inc.id)) return;
    const existing = resultMap.get(inc.id);
    if (!existing) {
      resultMap.set(inc.id, { ...inc });
    } else {
      resultMap.set(inc.id, {
        ...existing,
        ...inc,
        pin: inc.pin || existing.pin,
        role: inc.role || existing.role,
      });
    }
  });

  return Array.from(resultMap.values());
}

function mergeJustifications(currentJustifications: any[], incomingJustifications: any[]): any[] {
  if (!Array.isArray(incomingJustifications)) {
    return currentJustifications || [];
  }
  const resultMap = new Map<string, any>();
  (currentJustifications || []).forEach((j: any) => {
    if (j && j.id) resultMap.set(j.id, { ...j });
  });

  incomingJustifications.forEach((inc: any) => {
    if (!inc || !inc.id) return;
    const existing = resultMap.get(inc.id);
    if (!existing) {
      resultMap.set(inc.id, { ...inc });
    } else {
      resultMap.set(inc.id, { ...existing, ...inc });
    }
  });

  return Array.from(resultMap.values());
}

function mergeStudentGrades(currentGrades: any[], incomingGrades: any[]): any[] {
  if (!Array.isArray(incomingGrades)) {
    return currentGrades || [];
  }
  const resultMap = new Map<string, any>();
  (currentGrades || []).forEach((g: any) => {
    const key = g?.studentId ? `${g.studentId}_${g.classGroupId || ''}` : (g?.id || '');
    if (key) resultMap.set(key, { ...g });
  });

  incomingGrades.forEach((inc: any) => {
    const key = inc?.studentId ? `${inc.studentId}_${inc.classGroupId || ''}` : (inc?.id || '');
    if (!key) return;
    const existing = resultMap.get(key);
    if (!existing) {
      resultMap.set(key, { ...inc });
    } else {
      resultMap.set(key, { 
        ...existing, 
        ...inc,
        scores: { ...(existing.scores || {}), ...(inc.scores || {}) }
      });
    }
  });

  return Array.from(resultMap.values());
}

function recalculateStudentStats(students: any[], sessions: any[]): any[] {
  if (!Array.isArray(students)) return [];
  const safeSessions = Array.isArray(sessions) ? sessions : [];

  return students.map(st => {
    let presences = 0;
    let absences = 0;
    let lates = 0;
    let excused = 0;
    const stSessions = safeSessions.filter(s => s.classGroupId === st.classGroupId);
    const totalClasses = stSessions.length;

    stSessions.forEach(sess => {
      const rec = sess.attendance?.[st.id];
      if (rec) {
        const isPresent = rec.status === 'present' || 
          rec.period1Status === 'present' || 
          rec.period2Status === 'present' || 
          rec.p1StartStatus === 'present' || 
          rec.p1EndStatus === 'present' || 
          rec.p2StartStatus === 'present' || 
          rec.p2EndStatus === 'present';
        const isLate = rec.status === 'late' || rec.period1Status === 'late' || rec.period2Status === 'late';
        const isExcused = rec.status === 'excused' || rec.period1Status === 'excused' || rec.period2Status === 'excused';

        if (isPresent) {
          presences++;
        } else if (isLate) {
          presences++;
          lates++;
        } else if (isExcused) {
          presences++;
          excused++;
        } else {
          absences++;
        }
      } else {
        absences++;
      }
    });

    return {
      ...st,
      presences,
      absences,
      lates,
      excused,
      totalClasses,
    };
  });
}

function mergeState(current: ServerDatabase, incoming: any): ServerDatabase {
  if (!incoming || typeof incoming !== "object") return current;

  if (incoming.isExplicitReset) {
    return {
      ...getInitialDbState(),
      lastUpdated: Date.now(),
    };
  }

  const mergedDeletedSessionIds = Array.from(new Set([
    ...(current.deletedSessionIds || []),
    ...(Array.isArray(incoming.deletedSessionIds) ? incoming.deletedSessionIds : [])
  ]));

  const mergedDeletedProfessorIds = Array.from(new Set([
    ...(current.deletedProfessorIds || []),
    ...(Array.isArray(incoming.deletedProfessorIds) ? incoming.deletedProfessorIds : [])
  ]));

  // If user mutation is explicitly sent (e.g. user added/deleted students, classes, professors), adopt the explicit user state
  const professors = incoming.userMutation && Array.isArray(incoming.professors)
    ? incoming.professors.filter((p: any) => p && p.id && !mergedDeletedProfessorIds.includes(p.id))
    : mergeProfessors(current.professors, incoming.professors, mergedDeletedProfessorIds);

  const classes = incoming.userMutation && Array.isArray(incoming.classes)
    ? incoming.classes
    : mergeClasses(current.classes, incoming.classes);

  // Critical fix: When user deleted sessions (userMutation: true), strictly adopt the filtered list without reviving deleted sessions!
  const sessions = incoming.userMutation && Array.isArray(incoming.sessions)
    ? incoming.sessions.filter((s: any) => s && s.id && !mergedDeletedSessionIds.includes(s.id))
    : mergeSessions(current.sessions, incoming.sessions, mergedDeletedSessionIds);

  const rawStudents = incoming.userMutation && Array.isArray(incoming.students)
    ? incoming.students
    : mergeStudents(current.students, incoming.students);
  const students = recalculateStudentStats(rawStudents, sessions);

  const justifications = incoming.userMutation && Array.isArray(incoming.justifications)
    ? incoming.justifications
    : mergeJustifications(current.justifications, incoming.justifications);

  const studentGrades = incoming.userMutation && Array.isArray(incoming.studentGrades)
    ? incoming.studentGrades
    : mergeStudentGrades(current.studentGrades, incoming.studentGrades);

  const appSettings = incoming.appSettings ? { ...current.appSettings, ...incoming.appSettings } : current.appSettings;
  const activeProfessorId = current.activeProfessorId || professors[0]?.id || "";
  const selectedClassId = current.selectedClassId || classes[0]?.id || "";

  const clientTimestamp = Number(incoming.lastUpdated) || 0;
  const validClientTs = (clientTimestamp > 4000000000000 || isNaN(clientTimestamp)) ? Date.now() : clientTimestamp;
  const newTs = Math.max(validClientTs, current.lastUpdated || 0, Date.now());

  const now = Date.now();
  const teacherPresences: Record<string, any> = {
    ...(current.teacherPresences || {}),
    ...(incoming.teacherPresences || {}),
  };
  // Clean expired teacher presences (> 90s)
  Object.keys(teacherPresences).forEach((k) => {
    if (now - (teacherPresences[k]?.lastPing || 0) > 90000) {
      delete teacherPresences[k];
    }
  });

  const connectedDevices: Record<string, any> = {
    ...(current.connectedDevices || {}),
    ...(incoming.connectedDevices || {}),
  };
  // Clean expired devices (> 90s)
  Object.keys(connectedDevices).forEach((k) => {
    if (now - (connectedDevices[k]?.lastPing || 0) > 90000) {
      delete connectedDevices[k];
    }
  });

  return {
    ...current,
    professors,
    activeProfessorId,
    classes,
    students,
    sessions,
    deletedSessionIds: mergedDeletedSessionIds,
    deletedProfessorIds: mergedDeletedProfessorIds,
    justifications,
    studentGrades,
    appSettings,
    selectedClassId,
    teacherPresences,
    connectedDevices,
    lastUpdated: newTs,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.text({ type: ["text/*", "application/json"], limit: "50mb" }));

  const server = http.createServer(app);

  // WebSocket Server for instant multi-device live synchronization
  const wss = new WebSocketServer({ server, path: "/ws" });

  const broadcastState = (senderWs?: WebSocket, customType = "SYNC_STATE", senderClientId?: string) => {
    const payload = JSON.stringify({
      type: customType,
      state: dbState,
      senderClientId: senderClientId || (dbState as any).senderClientId,
      timestamp: Date.now(),
    });

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  };

  wss.on("connection", (ws) => {
    // Send current master state immediately upon connection
    ws.send(
      JSON.stringify({
        type: "SYNC_STATE",
        state: dbState,
        timestamp: Date.now(),
      })
    );

    ws.on("message", (rawMessage) => {
      try {
        const data = JSON.parse(rawMessage.toString());
        if (data.type === "PING") {
          ws.send(JSON.stringify({ type: "PONG", timestamp: Date.now() }));
        } else if (data.type === "DEVICE_HEARTBEAT" && data.device) {
          const dev = data.device;
          if (dev && dev.deviceId) {
            dbState.connectedDevices = {
              ...(dbState.connectedDevices || {}),
              [dev.deviceId]: {
                ...dev,
                lastPing: Date.now(),
                isOnline: true,
              },
            };
            broadcastState(undefined, "DEVICES_UPDATED");
          }
        } else if (data.type === "GET_STATE") {
          ws.send(
            JSON.stringify({
              type: "SYNC_STATE",
              state: dbState,
              timestamp: Date.now(),
            })
          );
        } else if (data.type === "UPDATE_STATE" && data.state) {
          const senderClientId = data.state.senderClientId;
          dbState = mergeState(dbState, data.state);
          saveDatabase(dbState);
          broadcastState(ws, "STATE_UPDATED", senderClientId);
        } else if (data.type === "RESET_STATE") {
          dbState = getInitialDbState();
          saveDatabase(dbState);
          broadcastState(undefined, "SYNC_STATE");
        }
      } catch (err) {
        console.error("WebSocket message handling error:", err);
      }
    });
  });

  // REST API Routes
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      connectedDevices: wss.clients.size,
      lastUpdated: dbState.lastUpdated,
    });
  });

  app.get("/api/devices", (req, res) => {
    const now = Date.now();
    const activeDevs = Object.values(dbState.connectedDevices || {}).filter(
      (d: any) => now - (d.lastPing || 0) <= 90000
    );
    res.json({
      success: true,
      devices: activeDevs,
      totalConnected: wss.clients.size,
    });
  });

  app.get("/api/sync/state", (req, res) => {
    res.json({
      success: true,
      state: dbState,
      connectedDevices: wss.clients.size,
      timestamp: Date.now(),
    });
  });

  app.post("/api/sync/state", (req, res) => {
    try {
      let updates = req.body;
      if (typeof updates === "string") {
        try {
          updates = JSON.parse(updates);
        } catch {
          // ignore
        }
      }
      if (updates && typeof updates === "object") {
        const senderClientId = updates.senderClientId;
        dbState = mergeState(dbState, updates);
        saveDatabase(dbState);
        broadcastState(undefined, "STATE_UPDATED", senderClientId);
        return res.json({ success: true, state: dbState });
      }
      return res.status(400).json({ error: "Invalid payload" });
    } catch (err) {
      console.error("Failed to update state via API:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Dedicated endpoint for reliable single/batch session deletion
  app.post("/api/sessions/delete", (req, res) => {
    try {
      const { sessionId, sessionIds, classGroupId, all, senderClientId } = req.body || {};
      let idsToDelete: string[] = [];

      if (Array.isArray(sessionIds) && sessionIds.length > 0) {
        idsToDelete = sessionIds.map(String);
      } else if (sessionId) {
        idsToDelete = [String(sessionId)];
      } else if (all && classGroupId) {
        idsToDelete = (dbState.sessions || [])
          .filter((s: any) => s && s.classGroupId === classGroupId)
          .map((s: any) => s.id);
      }

      if (idsToDelete.length === 0) {
        return res.json({ success: true, message: "No sessions to delete", deletedCount: 0, state: dbState });
      }

      const toDeleteSet = new Set(idsToDelete);
      dbState.sessions = (dbState.sessions || []).filter((s: any) => s && !toDeleteSet.has(s.id));
      
      const newDeletedIds = Array.from(new Set([
        ...(dbState.deletedSessionIds || []),
        ...idsToDelete
      ]));
      dbState.deletedSessionIds = newDeletedIds;

      // Recalculate student statistics
      dbState.students = recalculateStudentStats(dbState.students, dbState.sessions);
      dbState.lastUpdated = Date.now();

      saveDatabase(dbState);
      broadcastState(undefined, "STATE_UPDATED", senderClientId);

      return res.json({
        success: true,
        deletedCount: idsToDelete.length,
        deletedSessionIds: idsToDelete,
        state: dbState
      });
    } catch (err) {
      console.error("Failed to delete session(s) via API:", err);
      return res.status(500).json({ error: "Failed to delete session(s)" });
    }
  });

  // Dedicated endpoint for reliable professor deletion
  app.post("/api/professors/delete", (req, res) => {
    try {
      const { professorId, senderClientId } = req.body || {};
      if (!professorId) {
        return res.status(400).json({ error: "professorId is required" });
      }
      if ((dbState.professors || []).length <= 1) {
        return res.status(400).json({ error: "Não é permitido excluir o único docente do sistema" });
      }
      const toDeleteId = String(professorId);

      // Check if professor has an active live session
      const hasLiveSession = (dbState.sessions || []).some(
        (s: any) => s && s.professorId === toDeleteId && s.isLive && !s.isLocked
      );
      if (hasLiveSession) {
        return res.status(400).json({ 
          error: "Não é possível excluir o docente enquanto houver aula/chamada ao vivo em andamento vinculada a ele." 
        });
      }

      dbState.professors = (dbState.professors || []).filter((p: any) => p && p.id !== toDeleteId);
      
      const newDeletedIds = Array.from(new Set([
        ...(dbState.deletedProfessorIds || []),
        toDeleteId
      ]));
      dbState.deletedProfessorIds = newDeletedIds;

      if (dbState.activeProfessorId === toDeleteId) {
        dbState.activeProfessorId = dbState.professors[0]?.id || "";
      }

      // Unassign professor from classes
      dbState.classes = (dbState.classes || []).map((cls: any) => {
        if (cls.professorId === toDeleteId) {
          return { ...cls, professorId: "", professorName: "Docente Não Definido" };
        }
        return cls;
      });

      dbState.lastUpdated = Date.now();
      saveDatabase(dbState);
      broadcastState(undefined, "STATE_UPDATED", senderClientId);

      return res.json({
        success: true,
        professorId: toDeleteId,
        state: dbState
      });
    } catch (err) {
      console.error("Failed to delete professor via API:", err);
      return res.status(500).json({ error: "Failed to delete professor" });
    }
  });

  app.post("/api/attendance/checkin", (req, res) => {
    try {
      const { 
        registrationNumber, 
        studentId, 
        sessionId, 
        classGroupId, 
        deviceId, 
        checkinMethod = 'qrcode',
        period,
        allowOtherClass = false
      } = req.body || {};

      const cleanInput = (registrationNumber || '').toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      const cleanInputNoPrefix = cleanInput.replace(/^RA/i, '');
      const cleanInputNoZero = cleanInputNoPrefix.replace(/^0+/, '');

      // Find student
      const student = dbState.students.find((s: any) => {
        if (studentId && s.id === studentId) return true;
        const cleanDb = (s.registrationNumber || '').toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (cleanDb === cleanInput) return true;
        const cleanDbNoPrefix = cleanDb.replace(/^RA/i, '');
        if (cleanDbNoPrefix && cleanInputNoPrefix && cleanDbNoPrefix === cleanInputNoPrefix) return true;
        const cleanDbNoZero = cleanDbNoPrefix.replace(/^0+/, '');
        return cleanDbNoZero.length > 0 && cleanInputNoZero.length > 0 && cleanDbNoZero === cleanInputNoZero;
      });

      if (!student) {
        return res.status(404).json({ success: false, message: 'Aluno não encontrado no sistema com este RA/Matrícula.' });
      }

      // Intelligent target session resolution
      let targetSession: any = null;

      if (sessionId) {
        // If specific session requested:
        if ((dbState.deletedSessionIds || []).includes(sessionId)) {
          return res.status(410).json({ 
            success: false, 
            sessionDeleted: true, 
            message: 'Esta aula/chamada foi excluída pelo docente e não está mais ativa.' 
          });
        }

        const foundSession = (dbState.sessions || []).find((s: any) => s.id === sessionId);
        if (!foundSession) {
          return res.status(404).json({ 
            success: false, 
            message: 'A aula/chamada informada não foi localizada no sistema.' 
          });
        }

        if (foundSession.isLocked || !foundSession.isLive) {
          return res.status(403).json({ 
            success: false, 
            sessionLocked: true, 
            message: 'A chamada desta aula já foi encerrada e bloqueada pelo docente.' 
          });
        }

        targetSession = foundSession;
      } else {
        // No specific sessionId provided, look for active live session in student class or selected class
        targetSession = (dbState.sessions || []).find((s: any) => 
          s.isLive && !s.isLocked && (s.classGroupId === student.classGroupId || s.classGroupId === classGroupId || s.classGroupId === dbState.selectedClassId)
        );

        if (!targetSession) {
          targetSession = (dbState.sessions || []).find((s: any) => s.isLive && !s.isLocked);
        }
      }

      const todayStr = new Date().toISOString().split('T')[0];

      if (!targetSession) {
        // Check if there is a session for this class that was locked
        const lockedSession = (dbState.sessions || []).find((s: any) => 
          (s.classGroupId === student.classGroupId || s.classGroupId === classGroupId || s.classGroupId === dbState.selectedClassId) && 
          s.isLocked
        );

        if (lockedSession) {
          return res.status(403).json({ success: false, sessionLocked: true, message: 'Esta chamada já foi encerrada e bloqueada pelo docente.' });
        }

        return res.status(400).json({ success: false, sessionLocked: false, message: 'O professor ainda não iniciou a chamada desta turma. Aguarde a abertura da chamada.' });
      }

      if (targetSession.isLocked || !targetSession.isLive) {
        return res.status(403).json({ success: false, sessionLocked: true, message: 'Esta chamada já foi encerrada e bloqueada pelo docente.' });
      }

      const isOtherClass = student.classGroupId !== targetSession.classGroupId;
      if (isOtherClass && !allowOtherClass) {
        const studentClass = dbState.classes.find((c: any) => c.id === student.classGroupId);
        const targetClass = dbState.classes.find((c: any) => c.id === targetSession.classGroupId);
        return res.json({
          success: false,
          needsOtherClassConfirmation: true,
          student,
          studentClassName: studentClass?.name || 'Outra Turma',
          targetClassName: targetClass?.name || 'Turma Atual',
          message: `Aluno matriculado na ${studentClass?.name || 'outra turma'}. Confirma presença como reposição/turma cruzada?`
        });
      }

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      const currentPeriod = period || targetSession.activePeriod || 'both';

      const existingRec = targetSession.attendance?.[student.id];

      // Verificar se já está presente especificamente na etapa atual
      let isAlreadyPresent = false;
      if (existingRec) {
        if (currentPeriod === 'p1_start') {
          if (existingRec.p1StartStatus === 'present' || existingRec.p1StartStatus === 'late') isAlreadyPresent = true;
        } else if (currentPeriod === 'p1_end') {
          if (existingRec.p1EndStatus === 'present' || existingRec.p1EndStatus === 'late') isAlreadyPresent = true;
        } else if (currentPeriod === 'p2_start') {
          if (existingRec.p2StartStatus === 'present' || existingRec.p2StartStatus === 'late') isAlreadyPresent = true;
        } else if (currentPeriod === 'p2_end') {
          if (existingRec.p2EndStatus === 'present' || existingRec.p2EndStatus === 'late') isAlreadyPresent = true;
        } else if (currentPeriod === '1') {
          if (existingRec.period1Status === 'present' && existingRec.p1StartStatus === 'present' && existingRec.p1EndStatus === 'present') isAlreadyPresent = true;
        } else if (currentPeriod === '2') {
          if (existingRec.period2Status === 'present' && existingRec.p2StartStatus === 'present' && existingRec.p2EndStatus === 'present') isAlreadyPresent = true;
        } else if (currentPeriod === 'activity_single') {
          if (existingRec.status === 'present' || existingRec.status === 'late') isAlreadyPresent = true;
        } else if (currentPeriod === 'both') {
          if (existingRec.status === 'present' && existingRec.period1Status === 'present' && existingRec.period2Status === 'present' && existingRec.p1StartStatus === 'present' && existingRec.p1EndStatus === 'present' && existingRec.p2StartStatus === 'present' && existingRec.p2EndStatus === 'present') isAlreadyPresent = true;
        }
      }

      if (isAlreadyPresent) {
        const stageName = currentPeriod === 'p1_start' ? '1ª Aula (Início)'
          : currentPeriod === 'p1_end' ? '1ª Aula (Final)'
          : currentPeriod === 'p2_start' ? '2ª Aula (Início)'
          : currentPeriod === 'p2_end' ? '2ª Aula (Final)'
          : currentPeriod === '1' ? '1ª Aula'
          : currentPeriod === '2' ? '2ª Aula'
          : 'nesta chamada';
        return res.json({
          success: false,
          alreadyPresent: true,
          message: `Atenção: A presença de ${student.name} (RA: ${student.registrationNumber}) já foi confirmada para ${stageName}.`,
          student,
          existingRecord: existingRec,
        });
      }

      let newPeriod1 = existingRec?.period1Status || 'absent';
      let newPeriod2 = existingRec?.period2Status || 'absent';
      let newP1Start = existingRec?.p1StartStatus || 'absent';
      let newP1End = existingRec?.p1EndStatus || 'absent';
      let newP2Start = existingRec?.p2StartStatus || 'absent';
      let newP2End = existingRec?.p2EndStatus || 'absent';

      let newP1StartTime = existingRec?.p1StartTimestamp;
      let newP1EndTime = existingRec?.p1EndTimestamp;
      let newP2StartTime = existingRec?.p2StartTimestamp;
      let newP2EndTime = existingRec?.p2EndTimestamp;
      let newP1Time = existingRec?.period1Timestamp;
      let newP2Time = existingRec?.period2Timestamp;

      if (currentPeriod === 'p1_start') {
        newP1Start = 'present';
        newP1StartTime = timeStr;
        newPeriod1 = 'present';
        newP1Time = timeStr;
      } else if (currentPeriod === 'p1_end') {
        newP1End = 'present';
        newP1EndTime = timeStr;
        newPeriod1 = 'present';
        newP1Time = newP1Time || timeStr;
      } else if (currentPeriod === 'p2_start') {
        newP2Start = 'present';
        newP2StartTime = timeStr;
        newPeriod2 = 'present';
        newP2Time = timeStr;
      } else if (currentPeriod === 'p2_end') {
        newP2End = 'present';
        newP2EndTime = timeStr;
        newPeriod2 = 'present';
        newP2Time = newP2Time || timeStr;
      } else if (currentPeriod === '1') {
        newPeriod1 = 'present';
        newP1Start = 'present';
        newP1End = 'present';
        newP1StartTime = newP1StartTime || timeStr;
        newP1EndTime = timeStr;
        newP1Time = timeStr;
      } else if (currentPeriod === '2') {
        newPeriod2 = 'present';
        newP2Start = 'present';
        newP2End = 'present';
        newP2StartTime = newP2StartTime || timeStr;
        newP2EndTime = timeStr;
        newP2Time = timeStr;
      } else {
        newPeriod1 = 'present';
        newPeriod2 = 'present';
        newP1Start = 'present';
        newP1End = 'present';
        newP2Start = 'present';
        newP2End = 'present';
        newP1StartTime = newP1StartTime || timeStr;
        newP1EndTime = timeStr;
        newP2StartTime = newP2StartTime || timeStr;
        newP2EndTime = timeStr;
        newP1Time = timeStr;
        newP2Time = timeStr;
      }

      const updatedRecord = {
        studentId: student.id,
        status: 'present',
        period1Status: newPeriod1,
        period2Status: newPeriod2,
        p1StartStatus: newP1Start,
        p1EndStatus: newP1End,
        p2StartStatus: newP2Start,
        p2EndStatus: newP2End,
        p1StartTimestamp: newP1StartTime,
        p1EndTimestamp: newP1EndTime,
        p2StartTimestamp: newP2StartTime,
        p2EndTimestamp: newP2EndTime,
        period1Timestamp: newP1Time,
        period2Timestamp: newP2Time,
        timestamp: existingRec?.timestamp || timeStr,
        epiVerified: true,
        checkinMethod: checkinMethod,
        deviceId: deviceId || existingRec?.deviceId,
        isVerifiedLive: true,
      };

      const updatedSessions = dbState.sessions.map((s: any) => {
        if (s.id === targetSession.id) {
          return {
            ...s,
            attendance: {
              ...s.attendance,
              [student.id]: updatedRecord,
            }
          };
        }
        return s;
      });

      dbState.sessions = updatedSessions;
      dbState.students = recalculateStudentStats(dbState.students, updatedSessions);
      dbState.lastUpdated = Date.now();
      saveDatabase(dbState);
      broadcastState(undefined, "STATE_UPDATED", req.body?.senderClientId);

      return res.json({
        success: true,
        message: `Presença confirmada com sucesso para ${student.name}!`,
        student,
        session: targetSession,
        record: updatedRecord,
      });
    } catch (err: any) {
      console.error("Attendance checkin error:", err);
      return res.status(500).json({ success: false, message: 'Erro interno ao processar presença.' });
    }
  });

  // Outbox Offline Attendance Queue Processor
  app.post("/api/outbox/process", (req, res) => {
    try {
      const { items, senderClientId } = req.body || {};
      if (!Array.isArray(items) || items.length === 0) {
        return res.json({ success: true, processedCount: 0, message: "Nenhum item para processar." });
      }

      let modifiedSessions = false;
      const updatedSessions = [...dbState.sessions];

      items.forEach((item: any) => {
        if (!item || !item.sessionId) return;

        const sessionIndex = updatedSessions.findIndex((s: any) => s.id === item.sessionId);
        if (sessionIndex === -1) return;

        const targetSession = { ...updatedSessions[sessionIndex] };
        targetSession.attendance = { ...(targetSession.attendance || {}) };

        if (item.eventType === 'RECORD_ATTENDANCE' && item.studentId) {
          const existingRec = targetSession.attendance[item.studentId] || {};
          const studentRec = item.payload?.record || {
            studentId: item.studentId,
            status: item.status || 'present',
            period1Status: item.payload?.period1Status || (item.period === '2' ? 'absent' : (item.status || 'present')),
            period2Status: item.payload?.period2Status || (item.period === '1' ? 'absent' : (item.status || 'present')),
            p1StartStatus: item.payload?.p1StartStatus,
            p1EndStatus: item.payload?.p1EndStatus,
            p2StartStatus: item.payload?.p2StartStatus,
            p2EndStatus: item.payload?.p2EndStatus,
            timestamp: item.timestamp || new Date().toISOString(),
            epiVerified: item.payload?.epiVerified ?? true,
            checkinMethod: item.payload?.checkinMethod || 'offline_outbox',
            deviceId: item.deviceId || existingRec.deviceId,
            isVerifiedLive: true,
          };

          targetSession.attendance[item.studentId] = {
            ...existingRec,
            ...studentRec,
          };
          updatedSessions[sessionIndex] = targetSession;
          modifiedSessions = true;
        } else if (item.eventType === 'BATCH_ATTENDANCE' && item.payload?.attendance) {
          targetSession.attendance = {
            ...targetSession.attendance,
            ...item.payload.attendance,
          };
          updatedSessions[sessionIndex] = targetSession;
          modifiedSessions = true;
        } else if (item.eventType === 'EXCUSE_STUDENT' && item.studentId) {
          const existingRec = targetSession.attendance[item.studentId] || {};
          targetSession.attendance[item.studentId] = {
            ...existingRec,
            studentId: item.studentId,
            status: 'excused',
            period1Status: 'excused',
            period2Status: 'excused',
            justificationReason: item.payload?.reason || 'Justificativa de Falta',
            justificationFileUrl: item.payload?.fileUrl,
            justificationFileName: item.payload?.fileName,
            timestamp: item.timestamp,
          };
          updatedSessions[sessionIndex] = targetSession;
          modifiedSessions = true;
        }
      });

      if (modifiedSessions) {
        dbState.sessions = updatedSessions;
        dbState.students = recalculateStudentStats(dbState.students, updatedSessions);
        dbState.lastUpdated = Date.now();
        saveDatabase(dbState);
        broadcastState(undefined, "STATE_UPDATED", senderClientId);
      }

      return res.json({
        success: true,
        processedCount: items.length,
        message: `${items.length} marcações da fila Outbox sincronizadas com sucesso.`,
      });
    } catch (err: any) {
      console.error("Outbox process error:", err);
      return res.status(500).json({ success: false, message: "Erro ao processar fila outbox." });
    }
  });

  app.post("/api/session/delete", (req, res) => {
    try {
      const { sessionId, deletedSessionIds = [], senderClientId } = req.body || {};
      if (!sessionId) {
        return res.status(400).json({ success: false, message: "ID da sessão é obrigatório" });
      }

      const mergedDeleted = Array.from(new Set([
        ...(dbState.deletedSessionIds || []),
        ...(Array.isArray(deletedSessionIds) ? deletedSessionIds : []),
        sessionId,
      ]));

      dbState.deletedSessionIds = mergedDeleted;
      dbState.sessions = (dbState.sessions || []).filter((s: any) => s && s.id !== sessionId && !mergedDeleted.includes(s.id));
      dbState.students = recalculateStudentStats(dbState.students, dbState.sessions);
      dbState.lastUpdated = Date.now();
      saveDatabase(dbState);
      broadcastState(undefined, "STATE_UPDATED", senderClientId);

      return res.json({ success: true, message: "Chamada/relatório excluído com sucesso", deletedSessionId: sessionId });
    } catch (err: any) {
      console.error("Error deleting session:", err);
      return res.status(500).json({ success: false, message: "Erro ao excluir chamada" });
    }
  });

  app.post("/api/session/delete-all", (req, res) => {
    try {
      const { classGroupId, deletedSessionIds = [], senderClientId } = req.body || {};
      if (!classGroupId) {
        return res.status(400).json({ success: false, message: "ID da turma é obrigatório" });
      }

      const sessionsToDelete = (dbState.sessions || []).filter((s: any) => s && s.classGroupId === classGroupId);
      const idsToDelete = sessionsToDelete.map((s: any) => s.id);

      const mergedDeleted = Array.from(new Set([
        ...(dbState.deletedSessionIds || []),
        ...(Array.isArray(deletedSessionIds) ? deletedSessionIds : []),
        ...idsToDelete,
      ]));

      dbState.deletedSessionIds = mergedDeleted;
      dbState.sessions = (dbState.sessions || []).filter((s: any) => s && s.classGroupId !== classGroupId && !mergedDeleted.includes(s.id));
      dbState.students = recalculateStudentStats(dbState.students, dbState.sessions);
      dbState.lastUpdated = Date.now();
      saveDatabase(dbState);
      broadcastState(undefined, "STATE_UPDATED", senderClientId);

      return res.json({ success: true, message: `Todas as chamadas da turma foram excluídas`, deletedCount: idsToDelete.length });
    } catch (err: any) {
      console.error("Error deleting all sessions for class:", err);
      return res.status(500).json({ success: false, message: "Erro ao excluir chamadas da turma" });
    }
  });

  app.post("/api/sync/reset", (req, res) => {
    dbState = {
      ...getInitialDbState(),
      lastUpdated: Date.now(),
    };
    saveDatabase(dbState);
    const payload = JSON.stringify({
      type: "SYNC_STATE",
      state: {
        ...dbState,
        isExplicitReset: true,
      },
      senderClientId: req.body?.senderClientId,
      timestamp: Date.now(),
    });

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
    res.json({ success: true, message: "Banco de dados zerado com sucesso (em branco)", state: dbState });
  });

  // Vite middleware in dev or Static files in prod
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`BMF4 Real-time Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
