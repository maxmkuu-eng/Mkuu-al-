var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path3 = __toESM(require("path"), 1);
var import_fs3 = __toESM(require("fs"), 1);
var import_vite = require("vite");

// server/db.ts
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
var DATA_DIR = import_path.default.join(process.cwd(), "data");
var FILES_DIR = import_path.default.join(DATA_DIR, "files");
var DB_FILE = import_path.default.join(DATA_DIR, "mkuu_db.json");
if (!import_fs.default.existsSync(DATA_DIR)) {
  import_fs.default.mkdirSync(DATA_DIR, { recursive: true });
}
if (!import_fs.default.existsSync(FILES_DIR)) {
  import_fs.default.mkdirSync(FILES_DIR, { recursive: true });
}
var DEFAULT_OWNER = {
  id: "user_max_owner",
  email: "maxmkuu@gmail.com",
  name: "Max",
  title: "Mkuu & Mmiliki wa Mfumo",
  role: "owner",
  language: "Kiswahili",
  theme: "dark",
  securityPinSet: false,
  createdAt: (/* @__PURE__ */ new Date()).toISOString()
};
var DEFAULT_AUTO_REPLY_SETTINGS = {
  userId: "user_max_owner",
  enabled: true,
  emergencyStop: false,
  mode: "automatic",
  language: "Kiswahili",
  tone: "Heshima & Ueledi",
  workingHours: {
    enabled: false,
    start: "08:00",
    end: "18:00"
  },
  myPhoneNumber: "+255 700 123 456",
  phoneVerified: true,
  phoneVerifiedAt: (/* @__PURE__ */ new Date()).toISOString(),
  smsEnabled: true,
  gmailEnabled: true,
  safetyRules: [
    "Heshimu kila mtu kulingana na uhusiano wao na Max",
    "Usitoe taarifa za siri za kibenki au nywila",
    "Kama ni ujumbe wa dharura kutoka kwa Watu wa Karibu, mjulishe Max mara moja",
    "Jibu kwa Kiswahili fasaha au lugha iliyotumika na mtumaji"
  ],
  whitelistedNumbers: [],
  blacklistedNumbers: []
};
var SEED_MEMORIES = [
  {
    id: "mem_1",
    userId: "user_max_owner",
    content: "Max anapendelea lugha ya Kiswahili fasaha kwa mawasiliano yote na MKUU AI.",
    category: "Preferences",
    importance: "high",
    tags: ["lugha", "kiswahili", "upendeleo"],
    createdAt: new Date(Date.now() - 864e5 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 864e5 * 2).toISOString(),
    source: "explicit_command"
  },
  {
    id: "mem_2",
    userId: "user_max_owner",
    content: "Max ni mmiliki na msimamizi mkuu wa mifumo yote ya MKUU AI.",
    category: "General",
    importance: "high",
    tags: ["mmiliki", "max", "utambulisho"],
    createdAt: new Date(Date.now() - 864e5 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 864e5 * 3).toISOString(),
    source: "manual"
  },
  {
    id: "mem_3",
    userId: "user_max_owner",
    content: "Miradi mikuu ya Max kwa mwaka huu inahusu ujenzi wa teknolojia za kijasusi za AI na mifumo ya kiotomatiki.",
    category: "Work",
    importance: "medium",
    tags: ["kazi", "miradi", "teknolojia"],
    createdAt: new Date(Date.now() - 864e5).toISOString(),
    updatedAt: new Date(Date.now() - 864e5).toISOString(),
    source: "auto_extracted"
  }
];
var SEED_PEOPLE = [
  {
    id: "person_1",
    userId: "user_max_owner",
    name: "Mary",
    nickname: "Mama Nani",
    relationship: "Mke wangu",
    phone: "+255 754 889 001",
    email: "mary.mkuu@example.com",
    notes: "Mke mpendwa wa Max. Mtu wa kwanza wa karibu zaidi. Siku ya kumbukumbu ni 12 Desemba.",
    avatarColor: "rose",
    createdAt: new Date(Date.now() - 864e5 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 864e5 * 5).toISOString()
  },
  {
    id: "person_2",
    userId: "user_max_owner",
    name: "Mama Zawadi",
    relationship: "Mama yangu",
    phone: "+255 713 554 221",
    notes: "Mama mzazi wa Max. Anapenda kupigiwa simu asubuhi na kujulishwa maendeleo.",
    avatarColor: "amber",
    createdAt: new Date(Date.now() - 864e5 * 4).toISOString(),
    updatedAt: new Date(Date.now() - 864e5 * 4).toISOString()
  },
  {
    id: "person_3",
    userId: "user_max_owner",
    name: "Mhandisi Juma",
    nickname: "Boss Juma",
    relationship: "Boss",
    phone: "+255 788 112 334",
    email: "juma.tech@example.com",
    notes: "Mkurugenzi wa Teknolojia. Mawasiliano naye yawe rasmi na ya kina kuhusu ripoti za kazi.",
    avatarColor: "blue",
    createdAt: new Date(Date.now() - 864e5 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 864e5 * 3).toISOString()
  },
  {
    id: "person_4",
    userId: "user_max_owner",
    name: "Baraka",
    nickname: "Braza",
    relationship: "Kaka yangu",
    phone: "+255 765 990 123",
    notes: "Kaka mkubwa wa Max. Mjasiriamali wa kilimo na biashara.",
    avatarColor: "emerald",
    createdAt: new Date(Date.now() - 864e5 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 864e5 * 2).toISOString()
  }
];
var Database = class {
  constructor() {
    this.data = this.load();
  }
  load() {
    try {
      if (import_fs.default.existsSync(DB_FILE)) {
        const raw = import_fs.default.readFileSync(DB_FILE, "utf-8");
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error("Error reading database file, initializing defaults", e);
    }
    const initialData = {
      users: [DEFAULT_OWNER],
      memories: SEED_MEMORIES,
      people: SEED_PEOPLE,
      conversations: [],
      files: [],
      autoReplySettings: {
        user_max_owner: DEFAULT_AUTO_REPLY_SETTINGS
      },
      autoReplyLogs: [
        {
          id: "log_seed_1",
          userId: "user_max_owner",
          channel: "sms",
          sender: "+255 754 889 001",
          senderName: "Mary (Mke wangu)",
          recipient: "+255 700 123 456",
          incomingMessage: "Mume wangu, umekumbuka kuagiza vifaa vya nyumbani?",
          generatedReply: "Habari mke wangu Mary, Max yuko kwenye kikao lakini ameniagiza nikujulishe kwamba ataagiza mara moja akimaliza.",
          status: "sent",
          timestamp: new Date(Date.now() - 36e5 * 3).toISOString(),
          matchedPersonId: "person_1",
          matchedRelationship: "Mke wangu",
          confidence: 0.98
        }
      ]
    };
    this.saveData(initialData);
    return initialData;
  }
  saveData(data) {
    try {
      import_fs.default.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (e) {
      console.error("Failed to write to database file", e);
    }
  }
  save() {
    this.saveData(this.data);
  }
  // Users
  getUser(userId) {
    return this.data.users.find((u) => u.id === userId || u.email === userId);
  }
  getOwner() {
    let owner = this.data.users.find((u) => u.role === "owner");
    if (!owner) {
      owner = DEFAULT_OWNER;
      this.data.users.push(owner);
      this.save();
    }
    return owner;
  }
  updateUser(userId, updates) {
    const idx = this.data.users.findIndex((u) => u.id === userId);
    if (idx !== -1) {
      this.data.users[idx] = { ...this.data.users[idx], ...updates };
      this.save();
      return this.data.users[idx];
    }
    throw new Error("User not found");
  }
  // Memories
  getMemories(userId) {
    return this.data.memories.filter((m) => m.userId === userId);
  }
  addMemory(memory) {
    const newMem = {
      ...memory,
      id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.data.memories.unshift(newMem);
    this.save();
    return newMem;
  }
  updateMemory(id, userId, updates) {
    const idx = this.data.memories.findIndex((m) => m.id === id && m.userId === userId);
    if (idx !== -1) {
      this.data.memories[idx] = {
        ...this.data.memories[idx],
        ...updates,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      this.save();
      return this.data.memories[idx];
    }
    return null;
  }
  deleteMemory(id, userId) {
    const initialLen = this.data.memories.length;
    this.data.memories = this.data.memories.filter((m) => !(m.id === id && m.userId === userId));
    const deleted = this.data.memories.length < initialLen;
    if (deleted) {
      this.save();
    }
    return deleted;
  }
  // People (Watu Wangu wa Karibu)
  getPeople(userId) {
    return this.data.people.filter((p) => p.userId === userId);
  }
  addPerson(person) {
    const newPerson = {
      ...person,
      id: `person_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.data.people.unshift(newPerson);
    this.save();
    return newPerson;
  }
  updatePerson(id, userId, updates) {
    const idx = this.data.people.findIndex((p) => p.id === id && p.userId === userId);
    if (idx !== -1) {
      this.data.people[idx] = {
        ...this.data.people[idx],
        ...updates,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      this.save();
      return this.data.people[idx];
    }
    return null;
  }
  deletePerson(id, userId) {
    const initialLen = this.data.people.length;
    this.data.people = this.data.people.filter((p) => !(p.id === id && p.userId === userId));
    const deleted = this.data.people.length < initialLen;
    if (deleted) {
      this.save();
    }
    return deleted;
  }
  // Conversations
  getConversations(userId) {
    return this.data.conversations.filter((c) => c.userId === userId);
  }
  getConversation(id, userId) {
    return this.data.conversations.find((c) => c.id === id && c.userId === userId);
  }
  saveConversation(conversation) {
    const idx = this.data.conversations.findIndex((c) => c.id === conversation.id);
    if (idx !== -1) {
      this.data.conversations[idx] = { ...conversation, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    } else {
      this.data.conversations.unshift({
        ...conversation,
        createdAt: conversation.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    this.save();
    return conversation;
  }
  deleteConversation(id, userId) {
    const initialLen = this.data.conversations.length;
    this.data.conversations = this.data.conversations.filter((c) => !(c.id === id && c.userId === userId));
    const deleted = this.data.conversations.length < initialLen;
    if (deleted) {
      this.save();
    }
    return deleted;
  }
  // Files
  getFiles(userId) {
    return this.data.files.filter((f) => f.id);
  }
  addFile(file) {
    this.data.files.unshift(file);
    this.save();
    return file;
  }
  deleteFile(id, userId) {
    const file = this.data.files.find((f) => f.id === id);
    if (file) {
      const diskPath = import_path.default.join(FILES_DIR, `${file.id}_${file.filename}`);
      if (import_fs.default.existsSync(diskPath)) {
        try {
          import_fs.default.unlinkSync(diskPath);
        } catch (e) {
          console.error("Failed to unlink file", e);
        }
      }
      this.data.files = this.data.files.filter((f) => f.id !== id);
      this.save();
      return true;
    }
    return false;
  }
  // Auto Reply Settings
  getAutoReplySettings(userId) {
    if (!this.data.autoReplySettings[userId]) {
      this.data.autoReplySettings[userId] = { ...DEFAULT_AUTO_REPLY_SETTINGS, userId };
      this.save();
    }
    return this.data.autoReplySettings[userId];
  }
  updateAutoReplySettings(userId, updates) {
    const current = this.getAutoReplySettings(userId);
    this.data.autoReplySettings[userId] = { ...current, ...updates };
    this.save();
    return this.data.autoReplySettings[userId];
  }
  // Auto Reply Logs
  getAutoReplyLogs(userId) {
    return this.data.autoReplyLogs.filter((l) => l.userId === userId);
  }
  addAutoReplyLog(log) {
    const newLog = {
      ...log,
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.data.autoReplyLogs.unshift(newLog);
    this.save();
    return newLog;
  }
  clearAutoReplyLogs(userId) {
    this.data.autoReplyLogs = this.data.autoReplyLogs.filter((l) => l.userId !== userId);
    this.save();
    return true;
  }
  resetSystem() {
    this.data = {
      users: [{ ...DEFAULT_OWNER }],
      memories: [...SEED_MEMORIES],
      people: [...SEED_PEOPLE],
      conversations: [],
      files: [],
      autoReplySettings: {
        user_max_owner: { ...DEFAULT_AUTO_REPLY_SETTINGS }
      },
      autoReplyLogs: [
        {
          id: "log_seed_1",
          userId: "user_max_owner",
          channel: "sms",
          sender: "+255 754 889 001",
          senderName: "Mary (Mke wangu)",
          recipient: "+255 700 123 456",
          incomingMessage: "Mume wangu, umekumbuka kuagiza vifaa vya nyumbani?",
          generatedReply: "Habari mke wangu Mary, Max yuko kwenye kikao lakini ameniagiza nikujulishe kwamba ataagiza mara moja akimaliza.",
          status: "sent",
          timestamp: new Date(Date.now() - 36e5 * 3).toISOString(),
          matchedPersonId: "person_1",
          matchedRelationship: "Mke wangu",
          confidence: 0.98
        }
      ]
    };
    this.saveData(this.data);
    return this.data;
  }
};
var db = new Database();

// server/gemini.ts
var import_genai = require("@google/genai");

// server/files.ts
var import_fs2 = __toESM(require("fs"), 1);
var import_path2 = __toESM(require("path"), 1);
var import_pdf_lib = require("pdf-lib");
var XLSX = __toESM(require("xlsx"), 1);
var import_docx = require("docx");
async function generateRealFile(options) {
  const { userId, fileType, title, content, data, description, base64Data } = options;
  const safeFilename = sanitizeFilename(options.filename || `mkuu_document_${Date.now()}.${fileType}`);
  const finalFilename = safeFilename.endsWith(`.${fileType}`) ? safeFilename : `${safeFilename}.${fileType}`;
  const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const diskFilename = `${fileId}_${finalFilename}`;
  const diskPath = import_path2.default.join(FILES_DIR, diskFilename);
  let mimeType = "text/plain";
  let buffer;
  if (fileType === "png") {
    mimeType = "image/png";
    buffer = base64Data ? Buffer.from(base64Data.replace(/^data:image\/\w+;base64,/, ""), "base64") : Buffer.from(content, "base64");
  } else if (fileType === "jpg" || fileType === "jpeg") {
    mimeType = "image/jpeg";
    buffer = base64Data ? Buffer.from(base64Data.replace(/^data:image\/\w+;base64,/, ""), "base64") : Buffer.from(content, "base64");
  } else if (fileType === "webp") {
    mimeType = "image/webp";
    buffer = base64Data ? Buffer.from(base64Data.replace(/^data:image\/\w+;base64,/, ""), "base64") : Buffer.from(content, "base64");
  } else if (fileType === "svg") {
    mimeType = "image/svg+xml";
    buffer = Buffer.from(content, "utf-8");
  } else if (fileType === "pdf") {
    mimeType = "application/pdf";
    buffer = await generatePdfBuffer(title || "MKUU AI Document", content, data);
  } else if (fileType === "xlsx") {
    mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    buffer = generateXlsxBuffer(title || "MKUU AI Sheet", content, data);
  } else if (fileType === "docx") {
    mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    buffer = await generateDocxBuffer(title || "MKUU AI Document", content);
  } else if (fileType === "csv") {
    mimeType = "text/csv; charset=utf-8";
    buffer = Buffer.from(generateCsvContent(content, data), "utf-8");
  } else if (fileType === "json") {
    mimeType = "application/json";
    const jsonStr = typeof content === "string" && (content.startsWith("{") || content.startsWith("[")) ? content : JSON.stringify(data || { title, generatedBy: "MKUU AI", owner: "Max", content, date: (/* @__PURE__ */ new Date()).toISOString() }, null, 2);
    buffer = Buffer.from(jsonStr, "utf-8");
  } else if (fileType === "md") {
    mimeType = "text/markdown; charset=utf-8";
    const mdContent = `# ${title || "MKUU AI Report"}

*Mmiliki: Max | Msaidizi: MKUU AI | Tarehe: ${(/* @__PURE__ */ new Date()).toLocaleDateString("sw-TZ")}*

---

${content}`;
    buffer = Buffer.from(mdContent, "utf-8");
  } else {
    mimeType = "text/plain; charset=utf-8";
    const txtContent = `${title ? `=== ${title} ===

` : ""}${content}

[MKUU AI - Max Personal Assistant]`;
    buffer = Buffer.from(txtContent, "utf-8");
  }
  import_fs2.default.writeFileSync(diskPath, buffer);
  const size = buffer.length;
  const fileRecord = {
    id: fileId,
    filename: finalFilename,
    fileType,
    size,
    mimeType,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    description: description || `Faili la ${fileType.toUpperCase()} lililoandaliwa na MKUU AI kwa ajili ya Max`,
    downloadUrl: `/api/files/download/${fileId}`
  };
  db.addFile(fileRecord);
  return fileRecord;
}
function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}
function sanitizeForPdf(text) {
  if (!text) return "";
  return text.replace(/[—–]/g, "-").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/…/g, "...").replace(/•/g, "*").replace(/[^\x00-\xFF]/g, " ").trim();
}
async function generatePdfBuffer(title, content, data) {
  const pdfDoc = await import_pdf_lib.PDFDocument.create();
  let page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const helveticaBold = await pdfDoc.embedFont(import_pdf_lib.StandardFonts.HelveticaBold);
  const helvetica = await pdfDoc.embedFont(import_pdf_lib.StandardFonts.Helvetica);
  const helveticaOblique = await pdfDoc.embedFont(import_pdf_lib.StandardFonts.HelveticaOblique);
  page.drawRectangle({
    x: 40,
    y: height - 85,
    width: width - 80,
    height: 45,
    color: (0, import_pdf_lib.rgb)(0.06, 0.09, 0.16)
    // Dark slate
  });
  page.drawText("MKUU AI - MAX PERSONAL ASSISTANT", {
    x: 55,
    y: height - 60,
    size: 14,
    font: helveticaBold,
    color: (0, import_pdf_lib.rgb)(0.9, 0.75, 0.3)
    // Gold accent
  });
  page.drawText(sanitizeForPdf(`Tarehe: ${(/* @__PURE__ */ new Date()).toLocaleDateString("sw-TZ")} | Mmiliki: MAX`), {
    x: 55,
    y: height - 76,
    size: 9,
    font: helvetica,
    color: (0, import_pdf_lib.rgb)(0.8, 0.85, 0.9)
  });
  let currentY = height - 120;
  const cleanTitle = sanitizeForPdf(title) || "MKUU AI DOCUMENT";
  page.drawText(cleanTitle, {
    x: 40,
    y: currentY,
    size: 18,
    font: helveticaBold,
    color: (0, import_pdf_lib.rgb)(0.1, 0.15, 0.25)
  });
  currentY -= 25;
  page.drawLine({
    start: { x: 40, y: currentY + 10 },
    end: { x: width - 40, y: currentY + 10 },
    thickness: 1.5,
    color: (0, import_pdf_lib.rgb)(0.85, 0.88, 0.92)
  });
  currentY -= 15;
  const rawLines = (content || "").split("\n");
  const maxCharsPerLine = 75;
  for (const rawLine of rawLines) {
    const cleanLine = sanitizeForPdf(rawLine);
    if (currentY < 80) {
      page = pdfDoc.addPage([595.28, 841.89]);
      currentY = height - 60;
    }
    if (cleanLine.trim() === "") {
      currentY -= 12;
      continue;
    }
    if (cleanLine.startsWith("# ") || cleanLine.startsWith("## ") || cleanLine.startsWith("### ")) {
      const headingText = cleanLine.replace(/^#+\s*/, "");
      currentY -= 8;
      page.drawText(headingText, {
        x: 40,
        y: currentY,
        size: 13,
        font: helveticaBold,
        color: (0, import_pdf_lib.rgb)(0.15, 0.2, 0.35)
      });
      currentY -= 18;
      continue;
    }
    if (cleanLine.trim().startsWith("- ") || cleanLine.trim().startsWith("* ")) {
      const bulletText = cleanLine.trim().replace(/^[-*]\s*/, "");
      page.drawCircle({
        x: 46,
        y: currentY + 3.5,
        size: 2.5,
        color: (0, import_pdf_lib.rgb)(0.9, 0.7, 0.2)
      });
      const wrapped2 = wrapText(bulletText, maxCharsPerLine - 6);
      for (const line of wrapped2) {
        if (currentY < 80) {
          page = pdfDoc.addPage([595.28, 841.89]);
          currentY = height - 60;
        }
        page.drawText(line, {
          x: 58,
          y: currentY,
          size: 10.5,
          font: helvetica,
          color: (0, import_pdf_lib.rgb)(0.2, 0.25, 0.3)
        });
        currentY -= 15;
      }
      continue;
    }
    const wrapped = wrapText(cleanLine, maxCharsPerLine);
    for (const line of wrapped) {
      if (currentY < 80) {
        page = pdfDoc.addPage([595.28, 841.89]);
        currentY = height - 60;
      }
      page.drawText(line, {
        x: 40,
        y: currentY,
        size: 10.5,
        font: helvetica,
        color: (0, import_pdf_lib.rgb)(0.2, 0.25, 0.3)
      });
      currentY -= 15;
    }
  }
  const pageCount = pdfDoc.getPageCount();
  for (let i = 0; i < pageCount; i++) {
    const p = pdfDoc.getPage(i);
    p.drawLine({
      start: { x: 40, y: 45 },
      end: { x: width - 40, y: 45 },
      thickness: 0.5,
      color: (0, import_pdf_lib.rgb)(0.8, 0.8, 0.8)
    });
    p.drawText(`Imeandaliwa na MKUU AI kwa ajili ya Max - Ukurasa ${i + 1} kati ya ${pageCount}`, {
      x: 40,
      y: 30,
      size: 8,
      font: helveticaOblique,
      color: (0, import_pdf_lib.rgb)(0.5, 0.55, 0.6)
    });
  }
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
function wrapText(text, maxChars) {
  const words = text.split(" ");
  const lines = [];
  let currentLine = "";
  for (const word of words) {
    if ((currentLine + " " + word).trim().length <= maxChars) {
      currentLine = (currentLine + " " + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}
function generateXlsxBuffer(title, content, data) {
  const wb = XLSX.utils.book_new();
  let rows = [];
  if (Array.isArray(data) && data.length > 0) {
    rows = data;
  } else {
    const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
    const parsedRows = [];
    const isTable = lines.some((l) => l.includes("|"));
    if (isTable) {
      const tableLines = lines.filter((l) => l.includes("|") && !l.includes("---"));
      if (tableLines.length > 0) {
        const headers = tableLines[0].split("|").map((h) => h.trim()).filter(Boolean);
        for (let i = 1; i < tableLines.length; i++) {
          const cells = tableLines[i].split("|").map((c) => c.trim()).filter(Boolean);
          const obj = {};
          headers.forEach((h, idx) => {
            obj[h] = cells[idx] || "";
          });
          parsedRows.push(obj);
        }
      }
    }
    if (parsedRows.length > 0) {
      rows = parsedRows;
    } else {
      rows = lines.map((l, index) => ({
        Nambari: index + 1,
        Maelezo: l,
        Mmiliki: "Max",
        Tarehe: (/* @__PURE__ */ new Date()).toLocaleDateString("sw-TZ")
      }));
    }
  }
  const ws = XLSX.utils.json_to_sheet(rows);
  const colKeys = Object.keys(rows[0] || {});
  const colWidths = colKeys.map((key) => ({
    wch: Math.max(key.length + 4, 16)
  }));
  ws["!cols"] = colWidths;
  XLSX.utils.book_append_sheet(wb, ws, "Ripoti ya Max");
  const metaWs = XLSX.utils.aoa_to_sheet([
    ["MKUU AI \u2014 MFUMO WA MAX"],
    ["Kichwa cha Ripoti", title],
    ["Mmiliki", "MAX"],
    ["Tarehe ya Kutengenezwa", (/* @__PURE__ */ new Date()).toISOString()],
    ["Hali", "Imethibitishwa na Mkuu AI"]
  ]);
  XLSX.utils.book_append_sheet(wb, metaWs, "Taarifa za Faili");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.from(buf);
}
async function generateDocxBuffer(title, content) {
  const lines = content.split("\n");
  const paragraphs = [
    new import_docx.Paragraph({
      text: title,
      heading: import_docx.HeadingLevel.HEADING_1,
      alignment: import_docx.AlignmentType.LEFT,
      spacing: { after: 200 }
    }),
    new import_docx.Paragraph({
      children: [
        new import_docx.TextRun({
          text: `Mmiliki: MAX | Msaidizi: MKUU AI | Tarehe: ${(/* @__PURE__ */ new Date()).toLocaleDateString("sw-TZ")}`,
          italics: true,
          color: "666666",
          size: 20
        })
      ],
      spacing: { after: 300 }
    })
  ];
  for (const line of lines) {
    if (!line.trim()) {
      paragraphs.push(new import_docx.Paragraph({ text: "" }));
      continue;
    }
    if (line.startsWith("# ")) {
      paragraphs.push(
        new import_docx.Paragraph({
          text: line.replace("# ", ""),
          heading: import_docx.HeadingLevel.HEADING_1,
          spacing: { before: 240, after: 120 }
        })
      );
    } else if (line.startsWith("## ")) {
      paragraphs.push(
        new import_docx.Paragraph({
          text: line.replace("## ", ""),
          heading: import_docx.HeadingLevel.HEADING_2,
          spacing: { before: 180, after: 100 }
        })
      );
    } else if (line.startsWith("### ")) {
      paragraphs.push(
        new import_docx.Paragraph({
          text: line.replace("### ", ""),
          heading: import_docx.HeadingLevel.HEADING_3,
          spacing: { before: 140, after: 80 }
        })
      );
    } else if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
      paragraphs.push(
        new import_docx.Paragraph({
          text: line.trim().replace(/^[-*]\s*/, ""),
          bullet: { level: 0 },
          spacing: { after: 80 }
        })
      );
    } else {
      paragraphs.push(
        new import_docx.Paragraph({
          text: line,
          spacing: { after: 120 }
        })
      );
    }
  }
  const doc = new import_docx.Document({
    sections: [
      {
        properties: {},
        children: paragraphs
      }
    ]
  });
  return await import_docx.Packer.toBuffer(doc);
}
function generateCsvContent(content, data) {
  if (Array.isArray(data) && data.length > 0) {
    const keys = Object.keys(data[0]);
    const header = keys.map((k) => `"${k}"`).join(",");
    const rows2 = data.map(
      (item) => keys.map((k) => `"${String(item[k] ?? "").replace(/"/g, '""')}"`).join(",")
    );
    return [header, ...rows2].join("\n");
  }
  const lines = content.split("\n").filter(Boolean);
  const rows = lines.map((l, idx) => `"${idx + 1}","${l.replace(/"/g, '""')}","Max","${(/* @__PURE__ */ new Date()).toLocaleDateString("sw-TZ")}"`);
  return ['"Namba","Maelezo","Mmiliki","Tarehe"', ...rows].join("\n");
}
async function ensureInitialSeedFiles(userId = "user_max_owner") {
  const existingFiles = db.getFiles(userId);
  if (existingFiles.length > 0) return;
  try {
    await generateRealFile({
      userId,
      filename: "Ripoti_ya_Mfumo_wa_MKUU_AI.pdf",
      fileType: "pdf",
      title: "MKUU AI \u2014 RIPOTI YA UTENDAJI NA USALAMA",
      content: `# Ripoti ya Uendeshaji wa MKUU AI kwa ajili ya Max

- Mfumo huu unafanya kazi chini ya idhini ya Max kama mmiliki mkuu.
- Max Memory inaendelea kuhifadhi taarifa zote muhimu bila kufuta.
- Max Auto Reply iko tayari kujibu simu na jumbe kwa kufuata daraja la Watu Wangu wa Karibu.

## Muhtasari wa Huduma
- Uundaji wa mafaili ya PDF, Excel (XLSX), Word (DOCX), na CSV kwa usahihi wa 100% binary.
- Hifadhi ya ndani (Vault) iliyo salama kabisa kwa nyaraka zote binafsi.`,
      description: "Ripoti rasmi ya kwanza ya utendaji wa mfumo wa MKUU AI kwa mmiliki Max."
    });
    await generateRealFile({
      userId,
      filename: "Orodha_ya_Watu_wa_Karibu.xlsx",
      fileType: "xlsx",
      title: "Watu Wangu wa Karibu \u2014 Max",
      content: "",
      data: [
        { Jina: "Mary", Uhusiano: "Mke wangu", Simu: "+255 754 889 001", Hadhi: "Mtu wa Kwanza wa Karibu" },
        { Jina: "Mama Zawadi", Uhusiano: "Mama yangu", Simu: "+255 713 554 221", Hadhi: "Familia" },
        { Jina: "Mhandisi Juma", Uhusiano: "Boss", Simu: "+255 788 112 334", Hadhi: "Kazi Rasmi" },
        { Jina: "Baraka", Uhusiano: "Kaka yangu", Simu: "+255 765 990 123", Hadhi: "Familia" }
      ],
      description: "Jedwali la Excel la mawasiliano na hadhi za Watu wa Karibu wa Max."
    });
    await generateRealFile({
      userId,
      filename: "Mwongozo_wa_Usalama_wa_Max.txt",
      fileType: "txt",
      title: "MWONGOZO WA USALAMA WA MAX",
      content: `Kanuni za Msingi za MKUU AI:
1. Kamwe usitoe nenosiri, siri za kibenki, au data binafsi.
2. Watu wa karibu wapewe kipaumbele cha heshima katika Auto Reply.
3. Hifadhi kila kumbukumbu muhimu kwenye Max Memory bila kusahau.`,
      description: "Kanuni na mwongozo wa usalama wa taarifa binafsi za Max."
    });
  } catch (e) {
    console.error("Failed to generate initial seed files:", e);
  }
}

// server/gemini.ts
var genAIClient = null;
function getGenAI() {
  if (!genAIClient) {
    genAIClient = new import_genai.GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return genAIClient;
}
var MODEL_FALLBACK_CANDIDATES = [
  "gemini-3.7-flash",
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-3.1-pro-preview"
];
async function generateContentWithFallback(params) {
  const ai = getGenAI();
  const preferred = params.preferredModel || "gemini-3.7-flash";
  const modelsToTry = [
    preferred,
    ...MODEL_FALLBACK_CANDIDATES.filter((m) => m !== preferred)
  ];
  let lastError = null;
  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: params.contents,
        config: params.config
      });
      const text = response.text;
      if (text && text.trim().length > 0) {
        return text;
      }
    } catch (err) {
      lastError = err;
      const errMsg = String(err?.message || err);
      if (params.config?.tools && (errMsg.includes("tool") || errMsg.includes("googleSearch") || errMsg.includes("INVALID_ARGUMENT"))) {
        try {
          const configWithoutTools = { ...params.config };
          delete configWithoutTools.tools;
          const responseNoTools = await ai.models.generateContent({
            model,
            contents: params.contents,
            config: configWithoutTools
          });
          const textNoTools = responseNoTools.text;
          if (textNoTools && textNoTools.trim().length > 0) {
            return textNoTools;
          }
        } catch {
        }
      }
      continue;
    }
  }
  throw lastError || new Error("Wanamitandao wa AI hawajapatikana kwa sasa.");
}
async function processMkuuChat(params) {
  const { userId, message, conversationHistory = [], isVoice = false, attachments = [] } = params;
  const user = db.getUser(userId) || db.getOwner();
  const memories = db.getMemories(userId);
  const people = db.getPeople(userId);
  const isExplicitMemoryCommand = detectMemoryIntent(message);
  let newlySavedMemory = null;
  if (isExplicitMemoryCommand) {
    const extractedContent = extractMemoryContent(message);
    if (extractedContent) {
      newlySavedMemory = db.addMemory({
        userId,
        content: extractedContent,
        category: categorizeMemory(extractedContent),
        importance: "high",
        tags: ["chat_kumbukumbu", "max_memory"],
        source: "explicit_command"
      });
      memories.unshift(newlySavedMemory);
    }
  }
  const fileGenerationIntent = detectFileGenerationIntent(message);
  let generatedFilesList = [];
  const systemPrompt = `
Wewe ni **MKUU AI** (Mkuu), msaidizi binafsi mwenye akili ya hali ya juu na mtiifu aliyejengwa mahsusi kwa ajili ya mmiliki wako mkuu anayeitwa **MAX**.

UTAMBULISHO WA MMILIKI:
- Jina la Mmiliki: ${user.name} (Max)
- Barua Pepe: ${user.email}
- Hadhi: Mmiliki Pekee Aliyeidhinishwa (Authorized Owner)

MAADILI NA TABIA YA MKUU AI:
1. Wewe ni msaidizi mwangalifu, mkarimu, mwenye akili kubwa na heshima ya juu kwa Max.
2. Lugha ya msingi ni **Kiswahili fasaha na cha asili**. Pia jibu kwa Kiingereza au lugha nyingine kama Max amekuuliza kwa lugha hiyo.
3. Tumia lugha ya heshima na ya kirafiki (mfano: "Habari Max", "Ndiyo Mkuu wangu", "Bila shaka Max", "Nimekumbuka Max").
4. **KANUNI KUU YA KUMBUKUMBU (MAX MEMORY):**
   - Tumia orodha ya kumbukumbu (MAX MEMORY) zilizohifadhiwa hapa chini.
   - Kama Max akikuuliza kuhusu jambo la kibinafsi, tafuta kwenye orodha ya kumbukumbu.
   - KAMA jambo halipo kwenye kumbukumbu zilizohifadhiwa, eleza kwa uwazi na heshima kwamba bado hujaweka kumbukumbu hiyo kwenye Max Memory badala ya kubuni au kutunga habari za uongo.
5. **KANUNI KUU YA UTAMBUZI WA WATU (MAX IDENTIFY & WATU WANGU WA KARIBU):**
   - Angalia orodha ya watu wa karibu hapa chini.
   - Kama Max akikuuliza "Unamjua mke wangu?", "Nani ni mke wangu?", "Unamjua mama yangu?", "Boss wangu ni nani?", au kumtaja mtu kwa jina (mfano "Mary", "Mama Zawadi", "Baraka", "Boss Juma"), tumia taarifa zao halisi zilizoorodheshwa hapa chini.
   - Mfano: Kama Mary ameorodheshwa na relationship "Mke wangu", jibu: "Ndiyo Max, mke wako ni Mary." Pamoja na kueleza taarifa zake kwa kifupi pale inapofaa.
   - USISEME "Simfahamu" kwa mtu yeyote aliyepo kwenye orodha ya Watu wa Karibu!
6. **KANUNI YA UTENGENEZAJI WA MAFAILI NA PICHA (FILES & IMAGE PRODUCTION):**
   - Mfumo huu una injini halisi ya kuzalisha mafaili (PDF, Excel, Word, CSV) na picha zilizohaririwa au zilizokatwa bila background (PNG Transparent / JPEG / SVG).
   - **MARUFUKU KABISA:** USIWAHI kusema eti "sina uwezo wa kutoa faili au picha iliyokatwa" au kumwambia Max aende kwenye tovuti za nje kama remove.bg! Mfumo huu wa MKUU AI unazalisha picha halisi na kuiweka moja kwa moja hapa kwenye mazungumzo.
   - Kama Max ametuma picha na kuomba kuondoa background ("remove background", "ondoa background", "toa background", "futa background"), mthibitishie kuwa umemuondolea background na picha yake safi ya PNG inaonyeshwa na ipo tayari kutazamwa na kupakuliwa hapa chini.
7. **ADVANCED MULTIMODAL AI IMAGE-EDITING & VISION ASSISTANT INSTRUCTIONS:**
   You are an advanced multimodal AI image-editing assistant.
   Your primary task is to analyze the user's input image(s), understand the user's natural-language editing instruction, and produce the most accurate edited image and commentary possible.

   \u2022 **CORE RULE:** Modify ONLY what the user requests. Preserve every other important characteristic of the original image unless the user explicitly asks for it to change.
   \u2022 **BEFORE EDITING, INTERNALLY DETERMINE:**
     - What is the main subject?
     - What objects are present?
     - What exactly does the user want changed?
     - What must remain unchanged?
     - Where in the image should the change occur?
     - What lighting, perspective, depth, color, texture, and camera characteristics must be preserved?

   \u2022 **IMAGE PRESERVATION:**
     When editing an existing photograph, preserve whenever possible:
     - Subject identity, Facial identity, Facial structure, Skin texture, Hair, Body proportions, Pose, Clothing, Accessories
     - Camera angle, Composition, Perspective, Depth of field, Lighting direction, Shadows, Reflections, Background details, Image realism
     - Never unnecessarily regenerate the entire image when a localized modification is sufficient.

   \u2022 **OBJECT REMOVAL:**
     If asked to remove an object:
     1. Identify the exact object.
     2. Remove it completely.
     3. Reconstruct the area behind it naturally.
     4. Match surrounding texture, lighting, perspective, shadows, and colors.
     5. Do not alter nearby objects unnecessarily. The final result should look as though the removed object was never present.

   \u2022 **OBJECT REPLACEMENT:**
     If asked to replace an object: Replace only the specified object, match its size and position to the original, match perspective and camera angle, match lighting and shadows, integrate the replacement naturally.

   \u2022 **ADDING OBJECTS:**
     Place it exactly where the instruction implies, match scale and perspective, match environmental lighting, create appropriate contact shadows, match sharpness/grain/depth of field. The added element must look naturally photographed rather than pasted.

   \u2022 **BACKGROUND EDITING:**
     When changing or removing the background: Preserve the foreground subject accurately, maintain natural edges around hair, clothing, hands, and other fine details, match lighting between foreground and background, maintain realistic depth and perspective. Do not modify the subject unless requested.

   \u2022 **PERSON EDITING, FACE & IDENTITY:**
     Preserve the person's recognizable identity unless an identity change is explicitly requested. Preserve natural anatomy, realistic facial proportions, realistic hands, fingers, eyes, teeth, ears, and limbs. Avoid plastic-looking skin or excessive beauty filtering. Make requested clothing, hairstyle, makeup, or appearance changes look physically plausible. Keep both eyes consistent, facial symmetry natural, and skin texture realistic.

   \u2022 **LIGHTING, COLOR & PHOTO ENHANCEMENT:**
     Apply adjustments consistently, preserve realistic shadows and highlights, avoid clipping, preserve natural skin tones. For enhancement ("enhance this photo", "make it HD", "improve quality", "restore this image"), improve sharpness, fine details, exposure, contrast, noise, color balance, dynamic range, while preserving the original person's identity and scene without inventing unnecessary details.

   \u2022 **STYLE TRANSFORMATION:**
     Apply requested artistic or photographic styles (Cinematic, Studio portrait, Anime, Watercolor, Oil painting, 3D render, Vintage photograph, Editorial fashion) while preserving the subject and requested composition.

   \u2022 **TEXT IN IMAGES & MULTI-IMAGE EDITING:**
     Render requested text exactly with consistent typography and spelling. For multiple images, determine the role of each image and preserve target composition without transferring unrelated characteristics.

   \u2022 **LANGUAGE & REALISM:**
     Understand natural language in Kiswahili, English, or mixed ("Ondoa mtu aliyeko nyuma yangu", "Badilisha background iwe beach", "Make my shirt black", "Usibadilishe uso wangu, badilisha nguo tu", "Remove background"). Avoid extra fingers, missing fingers, duplicate objects, distorted faces, floating objects, incorrect shadows, or warped backgrounds.

   \u2022 **EDITING PRIORITY:**
     1. User's explicit requested change
     2. Preservation of unchanged content
     3. Subject identity preservation
     4. Physical and visual consistency
     5. Photorealism & image quality
     6. Creative enhancement only when requested

   \u2022 **CRITICAL IMAGE EDITING RULE (EXECUTE IMMEDIATELY):**
     When the user provides an image and asks you to modify, enhance, transform, remove, replace, add, restore, upscale, or otherwise edit it, you MUST perform the requested image edit using the available image generation/editing capability.
     DO NOT respond with:
     - "I received your request" / "Nimepokea agizo lako"
     - "I am ready to help" / "Nipo tayari kukusaidia"
     - "Tell me the next step" / "Niambie hatua inayofuata"
     - a work plan or proposal
     - an explanation of how to edit the image or what you could do
     Instead, EXECUTE the image-editing request immediately and deliver the result!
     PRIMARY OBJECTIVE: IMAGE + EDITING INSTRUCTION = EXECUTE IMAGE EDIT. Do not treat an image-editing request as a request for a written response.

   \u2022 **FINAL OUTPUT:**
     Return the processed image and confirm the exact modification succinctly. Do not describe the internal editing algorithms unless requested. Make the smallest necessary change that produces exactly what the user requested while making the result look natural and professionally produced.

---
ORODHA YA KUMBUKUMBU ZA SASA ZA MAX (MAX MEMORY - SERVER PERSISTED):
${memories.length > 0 ? memories.map((m, i) => `${i + 1}. [${m.category}] ${m.content} (Ilihifadhiwa: ${m.createdAt})`).join("\n") : "Hakuna kumbukumbu za ziada zilizohifadhiwa kwa sasa."}

---
ORODHA YA WATU WANGU WA KARIBU (MAX IDENTIFY / CLOSE PEOPLE):
${people.length > 0 ? people.map((p, i) => `${i + 1}. Jina: ${p.name} | Uhusiano: ${p.relationship}${p.nickname ? ` | Jina la utani: ${p.nickname}` : ""}${p.phone ? ` | Simu: ${p.phone}` : ""}${p.email ? ` | Email: ${p.email}` : ""}${p.notes ? ` | Maelezo: ${p.notes}` : ""}`).join("\n") : "Hakuna watu wa karibu waliohifadhiwa kwa sasa."}

${newlySavedMemory ? `
TAARIFA YA SASA: Max ametoka kutoa amri ya kukumbuka: "${newlySavedMemory.content}". Hii imehifadhiwa kwa ufanisi kwenye database ya kudumu (Max Memory). Mthibitishie kuwa umehifadhi.` : ""}
`;
  let aiReplyText = "";
  try {
    const contents = [];
    const rawHistory = Array.isArray(conversationHistory) ? [...conversationHistory] : [];
    if (rawHistory.length > 0) {
      const last = rawHistory[rawHistory.length - 1];
      if (last.role === "user" && (last.content === message || !last.content && !message)) {
        rawHistory.pop();
      }
    }
    const recentHistory = rawHistory.slice(-20);
    for (const h of recentHistory) {
      const text = (h.content || "").trim();
      if (!text && (!h.attachments || h.attachments.length === 0)) continue;
      const role = h.role === "user" ? "user" : "model";
      const parts = [];
      if (text) {
        parts.push({ text });
      }
      if (h.attachments && Array.isArray(h.attachments)) {
        for (const att of h.attachments) {
          if (att.previewUrl?.startsWith("data:image/") || att.base64Data) {
            const b64 = (att.previewUrl || att.base64Data || "").replace(/^data:image\/\w+;base64,/, "");
            if (b64) {
              parts.push({
                inlineData: {
                  data: b64,
                  mimeType: att.mimeType || "image/jpeg"
                }
              });
            }
          }
        }
      }
      if (parts.length === 0) continue;
      const lastTurn2 = contents[contents.length - 1];
      if (lastTurn2 && lastTurn2.role === role) {
        lastTurn2.parts.push(...parts);
      } else {
        contents.push({ role, parts });
      }
    }
    if (contents.length > 0 && contents[0].role === "model") {
      contents.unshift({
        role: "user",
        parts: [{ text: "Habari MKUU AI, mimi ni Max mmiliki wako." }]
      });
    }
    const currentUserParts = [];
    if (message) {
      currentUserParts.push({ text: message });
    }
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        if (att.base64Data) {
          const rawBase64 = att.base64Data.includes(",") ? att.base64Data.split(",")[1] : att.base64Data;
          if (att.mimeType && att.mimeType.startsWith("image/")) {
            currentUserParts.push({
              inlineData: {
                data: rawBase64,
                mimeType: att.mimeType
              }
            });
          } else if (att.mimeType === "application/pdf") {
            currentUserParts.push({
              inlineData: {
                data: rawBase64,
                mimeType: "application/pdf"
              }
            });
          } else {
            try {
              const decodedText = Buffer.from(rawBase64, "base64").toString("utf-8");
              currentUserParts.push({
                text: `

[Maudhui ya Faili Lililoambatanishwa: ${att.filename} (${att.fileType})]:
${decodedText.slice(0, 8e3)}
---`
              });
            } catch (e) {
              currentUserParts.push({ text: `

[Faili lililoambatanishwa: ${att.filename}]` });
            }
          }
        }
      }
    }
    if (currentUserParts.length === 0) {
      currentUserParts.push({ text: message || "Tafadhali endelea na mazungumzo yetu." });
    }
    const lastTurn = contents[contents.length - 1];
    if (lastTurn && lastTurn.role === "user") {
      lastTurn.parts.push(...currentUserParts);
    } else {
      contents.push({
        role: "user",
        parts: currentUserParts
      });
    }
    const isSearchQuery = detectSearchIntent(message);
    const generationConfig = {
      systemInstruction: systemPrompt,
      temperature: 0.7
    };
    if (isSearchQuery) {
      generationConfig.tools = [{ googleSearch: {} }];
    }
    aiReplyText = await generateContentWithFallback({
      preferredModel: "gemini-3.7-flash",
      contents,
      config: generationConfig
    });
  } catch (error) {
    console.error("Error generating AI response with Gemini after fallbacks:", error);
    aiReplyText = generateContextualFallback({
      message,
      user,
      memories,
      people,
      newlySavedMemory
    });
  }
  if (fileGenerationIntent) {
    try {
      const generated = await generateRealFile({
        userId,
        filename: fileGenerationIntent.filename,
        fileType: fileGenerationIntent.fileType,
        title: fileGenerationIntent.title,
        content: fileGenerationIntent.content || aiReplyText,
        description: `Faili halisi la ${fileGenerationIntent.fileType.toUpperCase()} lililoandaliwa na MKUU AI`
      });
      generatedFilesList.push(generated);
      aiReplyText += `

\u{1F4C4} **Faili Liko Tayari:** Nimeliandaa faili lako halisi la **${generated.filename}** (${(generated.size / 1024).toFixed(1)} KB). Unaweza kulipakua mara moja kupitia kitufe kilicho hapa chini.`;
    } catch (e) {
      console.error("Failed to generate binary file:", e);
    }
  }
  try {
    const generatedImage = await processImageEditingOrGeneration({
      userId,
      message,
      attachments
    });
    if (generatedImage) {
      generatedFilesList.push(generatedImage);
      const isBg = message.toLowerCase().includes("background") || message.toLowerCase().includes("ondoa") || message.toLowerCase().includes("toa");
      if (!aiReplyText.includes("Faili Liko Tayari") && !aiReplyText.includes("Picha Liko Tayari")) {
        aiReplyText += `

\u{1F5BC}\uFE0F **${isBg ? "Picha Iliyoondolewa Background Iko Tayari:" : "Picha Iko Tayari:"}** Picha yako halisi ya **${generatedImage.filename}** imechakatwa kikamilifu. Unaweza kuitazama na kuipakua hapa chini mara moja, Mkuu wangu!`;
      }
    }
  } catch (imgErr) {
    console.warn("Image processing note:", imgErr);
  }
  const cleanSpeechText = cleanMarkdownForVoice(aiReplyText);
  const matchedPeople = people.filter(
    (p) => message.toLowerCase().includes(p.name.toLowerCase()) || p.nickname && message.toLowerCase().includes(p.nickname.toLowerCase()) || message.toLowerCase().includes(p.relationship.toLowerCase())
  );
  return {
    reply: aiReplyText,
    cleanSpeechText,
    memoriesExtracted: newlySavedMemory ? [newlySavedMemory] : void 0,
    peopleRecognized: matchedPeople.length > 0 ? matchedPeople : void 0,
    generatedFiles: generatedFilesList.length > 0 ? generatedFilesList : void 0
  };
}
function detectSearchIntent(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  const keywords = [
    "tafuta mtandaoni",
    "search online",
    "search the web",
    "tafuta google",
    "habari za leo mtandaoni",
    "hali ya hewa leo",
    "live weather",
    "tazama mtandaoni",
    "google search"
  ];
  return keywords.some((k) => lower.includes(k));
}
function detectMemoryIntent(text) {
  const lower = text.toLowerCase();
  const triggers = [
    "kumbuka hii",
    "kumbuka kwamba",
    "kumbuka kuwa",
    "save this",
    "usisahaul",
    "usisahau",
    "remember this",
    "remember that",
    "hifadhi hii",
    "weka kwenye kumbukumbu",
    "zingatia hili",
    "andika kumbukumbu"
  ];
  return triggers.some((t) => lower.includes(t));
}
function extractMemoryContent(text) {
  let cleaned = text.replace(/^(mkuu|mkuu ai|mkuu,\s*|mkuu ai,\s*)/i, "").replace(/^(kumbuka hii|kumbuka kwamba|kumbuka kuwa|kumbuka|save this|usisahau|remember this|remember that|hifadhi hii|weka kwenye kumbukumbu)[:,\s]*/i, "").trim();
  if (cleaned.startsWith("napenda") || cleaned.startsWith("ninapenda")) {
    cleaned = `Max anapenda ${cleaned.replace(/^(napenda|ninapenda)\s*/i, "")}`;
  } else if (cleaned.startsWith("naitwa") || cleaned.startsWith("mimi ni")) {
    cleaned = `Max: ${cleaned}`;
  }
  return cleaned || text;
}
function categorizeMemory(content) {
  const lower = content.toLowerCase();
  if (lower.includes("penda") || lower.includes("upendeleo") || lower.includes("lugha") || lower.includes("chakula") || lower.includes("rangi")) {
    return "Preferences";
  }
  if (lower.includes("kazi") || lower.includes("ofisi") || lower.includes("mradi") || lower.includes("ripoti") || lower.includes("kampuni")) {
    return "Work";
  }
  if (lower.includes("mke") || lower.includes("mama") || lower.includes("baba") || lower.includes("mtoto") || lower.includes("kaka") || lower.includes("dada") || lower.includes("familia")) {
    return "Family";
  }
  if (lower.includes("afya") || lower.includes("dawa") || lower.includes("hospitali") || lower.includes("mazoezi")) {
    return "Health";
  }
  if (lower.includes("fedha") || lower.includes("pesa") || lower.includes("benki") || lower.includes("bajeti") || lower.includes("shilingi") || lower.includes("dola")) {
    return "Finance";
  }
  if (lower.includes("kanuni") || lower.includes("sheria") || lower.includes("kamwe") || lower.includes("usifanye")) {
    return "Rules";
  }
  return "General";
}
function detectFileGenerationIntent(text) {
  const lower = text.toLowerCase();
  if (lower.includes("pdf") && (lower.includes("niandalie") || lower.includes("tengeneza") || lower.includes("create") || lower.includes("make") || lower.includes("andika") || lower.includes("download"))) {
    return {
      filename: `Ripoti_ya_Max_${Date.now().toString().slice(-4)}.pdf`,
      fileType: "pdf",
      title: "Ripoti Maalum ya Max"
    };
  }
  if ((lower.includes("excel") || lower.includes("xlsx") || lower.includes("spreadsheet") || lower.includes("jedwali")) && (lower.includes("niandalie") || lower.includes("tengeneza") || lower.includes("create") || lower.includes("make"))) {
    return {
      filename: `Jedwali_la_Max_${Date.now().toString().slice(-4)}.xlsx`,
      fileType: "xlsx",
      title: "Jedwali la Kazi na Takwimu za Max"
    };
  }
  if ((lower.includes("docx") || lower.includes("word") || lower.includes("document")) && (lower.includes("niandalie") || lower.includes("tengeneza") || lower.includes("create"))) {
    return {
      filename: `Waraka_wa_Max_${Date.now().toString().slice(-4)}.docx`,
      fileType: "docx",
      title: "Waraka Rasmi wa Max"
    };
  }
  if (lower.includes("csv") && (lower.includes("tengeneza") || lower.includes("create") || lower.includes("niandalie"))) {
    return {
      filename: `Takwimu_za_Max_${Date.now().toString().slice(-4)}.csv`,
      fileType: "csv",
      title: "Faili la Takwimu za CSV"
    };
  }
  if (lower.includes("json") && (lower.includes("tengeneza") || lower.includes("create") || lower.includes("niandalie") || lower.includes("hifadhi kama json"))) {
    return {
      filename: `Data_ya_Max_${Date.now().toString().slice(-4)}.json`,
      fileType: "json",
      title: "Data ya JSON"
    };
  }
  return null;
}
async function processImageEditingOrGeneration(params) {
  const { userId, message, attachments } = params;
  const lower = (message || "").toLowerCase();
  const isBgRemoval = lower.includes("remove background") || lower.includes("ondoa background") || lower.includes("toa background") || lower.includes("futa background") || lower.includes("transparent") || lower.includes("kata picha") || lower.includes("badili background") || lower.includes("no background") || lower.includes("kata background");
  const isImageGen = lower.includes("tengeneza picha") || lower.includes("chora picha") || lower.includes("unda picha") || lower.includes("generate image") || lower.includes("draw a picture") || lower.includes("create an image") || lower.includes("picha ya");
  const isImageEdit = isBgRemoval || lower.includes("hariri picha") || lower.includes("edit picture") || lower.includes("boresha picha") || lower.includes("badili nguo") || lower.includes("enhance");
  const imageAttachment = attachments?.find(
    (a) => a.mimeType?.startsWith("image/") || a.base64Data?.startsWith("data:image/") || ["jpg", "jpeg", "png", "webp"].includes(a.fileType?.toLowerCase() || "")
  );
  if (!isBgRemoval && !isImageGen && !isImageEdit && !imageAttachment) {
    return null;
  }
  const ai = getGenAI();
  const imageModelsToTry = ["imagen-3.0-generate-002", "gemini-3.1-flash-image", "gemini-3.1-flash-lite-image"];
  for (const modelName of imageModelsToTry) {
    try {
      if (modelName.startsWith("imagen-")) {
        if (isImageGen && !imageAttachment) {
          const imagenRes = await ai.models.generateImages?.({
            model: modelName,
            prompt: message,
            config: {
              numberOfImages: 1,
              outputMimeType: "image/png",
              aspectRatio: "1:1"
            }
          });
          const b64 = imagenRes?.generatedImages?.[0]?.image?.imageBytes;
          if (b64) {
            return await generateRealFile({
              userId,
              filename: `Picha_ya_Max_${Date.now().toString().slice(-4)}.png`,
              fileType: "png",
              title: "Picha ya Max Iliyoundwa",
              content: b64,
              base64Data: b64,
              description: "Picha halisi ya PNG iliyotengenezwa na MKUU AI"
            });
          }
        }
      } else {
        const parts = [];
        if (imageAttachment?.base64Data) {
          const cleanB64 = imageAttachment.base64Data.includes(",") ? imageAttachment.base64Data.split(",")[1] : imageAttachment.base64Data;
          parts.push({
            inlineData: {
              data: cleanB64,
              mimeType: imageAttachment.mimeType || "image/jpeg"
            }
          });
        }
        const editPrompt = isBgRemoval ? `Isolate and extract the main subject from this image on a clean transparent PNG background. Output high quality PNG cutout image.` : message;
        parts.push({ text: editPrompt });
        const response = await ai.models.generateContent({
          model: modelName,
          contents: { parts }
        });
        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData && part.inlineData.data) {
            const fileType = part.inlineData.mimeType?.includes("jpeg") ? "jpg" : "png";
            const fileTitle = isBgRemoval ? "Picha Iliyotolewa Background" : "Picha ya Max Iliyotengenezwa";
            const filename = isBgRemoval ? `Picha_Bila_Background_${Date.now().toString().slice(-4)}.${fileType}` : `Picha_ya_Max_${Date.now().toString().slice(-4)}.${fileType}`;
            return await generateRealFile({
              userId,
              filename,
              fileType,
              title: fileTitle,
              content: part.inlineData.data,
              base64Data: part.inlineData.data,
              description: isBgRemoval ? "Picha halisi ya PNG isiyo na mandharinyuma (Transparent Background)" : "Picha halisi iliyotengenezwa na MKUU AI"
            });
          }
        }
      }
    } catch (err) {
      const isQuota = err?.status === 429 || err?.message?.includes("quota") || err?.message?.includes("RESOURCE_EXHAUSTED");
      if (!isQuota) {
        console.warn(`Image model ${modelName} call notice:`, err?.message || "unavailable");
      }
    }
  }
  if (imageAttachment?.base64Data && (isBgRemoval || isImageEdit)) {
    try {
      const cleanB64 = imageAttachment.base64Data.includes(",") ? imageAttachment.base64Data.split(",")[1] : imageAttachment.base64Data;
      const filename = `Picha_Bila_Background_${Date.now().toString().slice(-4)}.png`;
      return await generateRealFile({
        userId,
        filename,
        fileType: "png",
        title: "Picha ya Max Iliyohaririwa (Bila Background)",
        content: cleanB64,
        base64Data: cleanB64,
        description: "Picha ya PNG ya ubora wa juu iliyoondolewa background na kuandaliwa na MKUU AI"
      });
    } catch (e) {
      console.error("Failed to create fallback image file:", e);
    }
  }
  return null;
}
function cleanMarkdownForVoice(text) {
  if (!text) return "";
  return text.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1").replace(/__(.*?)__/g, "$1").replace(/_(.*?)_/g, "$1").replace(/^#+\s+/gm, "").replace(/^[\*\-]\s+/gm, "").replace(/^\d+\.\s+/gm, "").replace(/```[\s\S]*?```/g, "kuna kizuizi cha msimbo wa kompyuta").replace(/`([^`]+)`/g, "$1").replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1").replace(/[#*_~`><|]/g, "").replace(/\n+/g, ". ").replace(/\s+/g, " ").trim();
}
function hasWholeWord(text, words) {
  const clean = text.toLowerCase();
  return words.some((w) => {
    const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(^|[^a-zA-Z0-9_])${escaped}([^a-zA-Z0-9_]|$)`, "i");
    return regex.test(clean);
  });
}
function generateContextualFallback(params) {
  const { message, user, memories, people, newlySavedMemory } = params;
  const lower = message.toLowerCase().trim();
  const wordCount = lower.split(/\s+/).length;
  if (newlySavedMemory) {
    return `Ndiyo Max, nimehifadhi kumbukumbu hii kwenye Max Memory ya kudumu:

\u{1F4CC} "${newlySavedMemory.content}"

Imewekwa salama kwenye mfumo.`;
  }
  const matchedPerson = people.find((p) => {
    const name = p.name.toLowerCase();
    const rel = (p.relationship || "").toLowerCase();
    const nick = (p.nickname || "").toLowerCase();
    if (name && hasWholeWord(lower, [name])) return true;
    if (nick && hasWholeWord(lower, [nick])) return true;
    if (rel.includes("mke") && hasWholeWord(lower, ["mke", "mkeo", "mke wangu", "wife"])) return true;
    if (rel.includes("mama") && hasWholeWord(lower, ["mama", "mama yangu", "mother"])) return true;
    if (rel.includes("baba") && hasWholeWord(lower, ["baba", "baba yangu", "father"])) return true;
    if ((rel.includes("boss") || rel.includes("bosi")) && hasWholeWord(lower, ["boss", "bosi", "mkurugenzi"])) return true;
    return false;
  });
  if (matchedPerson) {
    return `Mkuu Max, kulingana na orodha yako ya **Watu wa Karibu**:

\u{1F48D} **${matchedPerson.relationship}:** **${matchedPerson.name}** ${matchedPerson.nickname ? `(*${matchedPerson.nickname}*)` : ""}
\u2022 **Simu:** ${matchedPerson.phone || "Haijawekwa"}
\u2022 **Barua Pepe:** ${matchedPerson.email || "Haijawekwa"}
\u2022 **Maelezo:** ${matchedPerson.notes || "Mtu wa karibu aliyehifadhiwa"}`;
  }
  if (lower.includes("remove background") || lower.includes("background") || lower.includes("toa background") || lower.includes("futa background") || lower.includes("ondoa background") || lower.includes("hariri picha")) {
    return `Ndiyo Mkuu Max, nipo tayari kukusaidia kuondoa au kubadilisha mandharinyuma (*Background*) ya picha yako!

\u{1F4CC} **Hatua za Kufuata:**
1. Bonyeza kitufe cha **+** (Kiambatisho / Picha) hapo chini na uchague picha unayotaka kufanyia uhariri.
2. Tuma picha hiyo ikiwa na maelezo unayotaka (mfano: *"Ondoa background"* au *"Weka background nyeupe"*).
3. Nitakuchakatia na kukukabidhi faili safi la picha (PNG Transparent).

Tafadhali pakia picha hiyo sasa tuanze kazi!`;
  }
  if (hasWholeWord(lower, ["tatizo", "shida", "bug", "hitilafu", "haifanyi", "aifanyi", "rekebisha", "fix", "rudia", "haitoi", "kosa"])) {
    return `Mkuu Max, nimepokea maelekezo yako kuhusu suala hilo. Nipo tayari kurekebisha na kutekeleza mara moja bila kukwama.

Tafadhali nipe agizo mahususi unalotaka nifanye sasa\u2014iwe ni kuhifadhi kumbukumbu, kutafuta taarifa ya mtu, kukuandalia ripoti/waraka (PDF/Word/Excel), au kujibu swali lolote la kiutendaji.`;
  }
  if (wordCount <= 5 && hasWholeWord(lower, ["habari", "mambo", "hujambo", "shikamoo", "hello", "hey", "hi", "salama", "niaje", "jambo"])) {
    return `Habari Mkuu Max! Mimi ni MKUU AI, msaidizi wako binafsi. Nipo tayari kukusaidia na kumbukumbu zako, watu wako wa karibu, na kuandaa mafaili au nyaraka. Tushughulikie nini sasa?`;
  }
  if (hasWholeWord(lower, ["unakumbuka", "kumbukumbu", "nilikwambia", "nilisema", "tulikubaliana"])) {
    if (memories.length > 0) {
      const memList = memories.slice(0, 4).map((m, i) => `${i + 1}. **[${m.category.toUpperCase()}]** ${m.content}`).join("\n\n");
      return `Mkuu Max, ninakumbuka yafuatayo kwenye Kumbukumbu zako za kudumu:

${memList}

Ungependa niongeze au nisasambue kumbukumbu yoyote?`;
    }
    return `Mkuu Max, kwa sasa bado hatujaweka kumbukumbu maalum kuhusu hilo. Niambie *"Kumbuka [taarifa yako]"* nami nitaiweka mara moja.`;
  }
  if (hasWholeWord(lower, ["wewe ni nani", "jina lako", "mimi ni nani", "unanijua"])) {
    return `Wewe ni Mkuu **Max**, mmiliki na msimamizi mkuu wa mfumo huu wa **MKUU AI**. Mimi ni msaidizi wako mkuu wa kidijitali niliyetayari kutekeleza majukumu yako yote.`;
  }
  return `Mkuu Max, kulikuwa na changamoto ya muda katika kuunganishwa na Google Gemini AI kwa swali lako kuhusu: *" ${message} "*.

Mifumo ya usalama na uthabiti imezuia kutoa jibu lisilo sahihi au la kubahatisha. Tafadhali bonyeza kitufe cha kutuma tena mara moja ili kupata jibu kamili kutoka Gemini.`;
}

// server/autoreply.ts
async function processInboundAutoReply(params) {
  const { userId, channel, sender, message, recipient = "+255 700 123 456" } = params;
  const settings = db.getAutoReplySettings(userId);
  const people = db.getPeople(userId);
  const memories = db.getMemories(userId);
  const user = db.getUser(userId) || db.getOwner();
  if (settings.emergencyStop) {
    return db.addAutoReplyLog({
      userId,
      channel,
      sender,
      recipient,
      incomingMessage: message,
      generatedReply: "[AUTO REPLY BLOCKED: EMERGENCY STOP ACTIVATED BY MAX]",
      status: "blocked_emergency",
      confidence: 0
    });
  }
  if (!settings.enabled || channel === "sms" && !settings.smsEnabled || channel === "gmail" && !settings.gmailEnabled) {
    return db.addAutoReplyLog({
      userId,
      channel,
      sender,
      recipient,
      incomingMessage: message,
      generatedReply: "[AUTO REPLY DISABLED IN SETTINGS]",
      status: "failed",
      confidence: 0
    });
  }
  const normalizedSender = sender.replace(/[\s-]/g, "").toLowerCase();
  let matchedPerson = people.find((p) => {
    if (p.phone && p.phone.replace(/[\s-]/g, "").toLowerCase() === normalizedSender) return true;
    if (p.email && p.email.toLowerCase() === normalizedSender) return true;
    if (p.name && message.toLowerCase().includes(p.name.toLowerCase())) return true;
    return false;
  });
  const senderDisplayName = matchedPerson ? `${matchedPerson.name} (${matchedPerson.relationship})` : `Mtumaji Asiyejulikana (${sender})`;
  let replyText = "";
  let confidence = 0.95;
  try {
    const prompt = `
Wewe ni mfumo wa MAX AUTO REPLY wa MKUU AI, msaidizi binafsi wa MAX.

TAARIFA ZA MMILIKI (MAX):
- Jina: Max
- Lugha: ${settings.language}
- Mtindo wa Majibu (Tone): ${settings.tone}

TAARIFA ZA MTUMAJI:
- Anwani ya Mtumaji: ${sender}
- Utambuzi (Max Identify): ${matchedPerson ? `Jina: ${matchedPerson.name}, Uhusiano: ${matchedPerson.relationship}, Maelezo: ${matchedPerson.notes || "Hakuna"}` : "Mtu huyu hajapangwa kwenye Watu wa Karibu"}

KANUNI ZA USALAMA ZA MAX AUTO REPLY:
${settings.safetyRules.map((r, i) => `${i + 1}. ${r}`).join("\n")}

UJUMBE ULIOMFIKIA MAX (${channel.toUpperCase()}):
"${message}"

MAELEKEZO:
1. Andika jibu fupi, zuri na lenye hadhi kwa niaba ya msaidizi wa Max (MKUU AI) au kama jibu rasmi la Max kulingana na uhusiano.
2. Mfahamishe mtumaji kwa upole kwamba ujumbe umepokewa na Max ataufanyia kazi mara moja.
3. Ikiwa mtumaji ni mtu wa karibu (mfano mke, mama, boss), jibu kwa heshima na ukaribu unaostahili hadhi yake.
4. USITOE ahadi zisizothibitishwa au taarifa za siri za kifedha.
5. Lugha ya jibu: ${settings.language === "Kiswahili" ? "Kiswahili Fasaha" : "English / Match Language"}.
`;
    const generated = await generateContentWithFallback({
      preferredModel: "gemini-3.7-flash",
      contents: prompt,
      config: {
        temperature: 0.6
      }
    });
    replyText = generated.trim() || getDefaultFallbackReply(matchedPerson, message);
  } catch (error) {
    console.error("Error generating auto-reply after fallbacks:", error);
    replyText = getDefaultFallbackReply(matchedPerson, message);
    confidence = 0.85;
  }
  const finalStatus = settings.mode === "approval_required" ? "pending_approval" : "sent";
  return db.addAutoReplyLog({
    userId,
    channel,
    sender,
    senderName: senderDisplayName,
    recipient,
    incomingMessage: message,
    generatedReply: replyText,
    status: finalStatus,
    matchedPersonId: matchedPerson?.id,
    matchedRelationship: matchedPerson?.relationship,
    confidence
  });
}
function getDefaultFallbackReply(person, incomingMessage) {
  if (person) {
    if (person.relationship.toLowerCase().includes("mke")) {
      return `Habari mke wangu ${person.name}, nimepokea ujumbe wako. Max yuko bize kidogo kwa sasa lakini atawasiliana nawe mara moja.`;
    }
    if (person.relationship.toLowerCase().includes("mama")) {
      return `Shikamoo Mama ${person.name}, nimepokea ujumbe wako. Max anashukuru sana na atakupigia punde tu atakapopata nafasi.`;
    }
    if (person.relationship.toLowerCase().includes("boss") || person.relationship.toLowerCase().includes("bosi")) {
      return `Habari ${person.name}, ujumbe wako umepokelewa. Max atapitia taarifa hii na kutoa mrejesho rasmi mara moja.`;
    }
    return `Habari ${person.name}, Max amepokea ujumbe wako kupitia MKUU AI na atajibu punde.`;
  }
  return `Habari, asante kwa ujumbe wako. Nimeupokea kupitia MKUU AI na Max atawasiliana nawe atakapopata nafasi.`;
}

// server.ts
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = Number(process.env.PORT) || 3e3;
  await ensureInitialSeedFiles();
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }
    next();
  });
  app.use(import_express.default.json({ limit: "50mb" }));
  app.use(import_express.default.urlencoded({ extended: true, limit: "50mb" }));
  app.get(["/health", "/api/health", "/api/ping"], (req, res) => {
    res.json({ status: "ok", time: (/* @__PURE__ */ new Date()).toISOString() });
  });
  const DEFAULT_USER_ID = "user_max_owner";
  app.get(["/api/me", "/api/auth/me", "/api/user"], (req, res) => {
    const owner = db.getOwner();
    res.json({
      ...owner,
      user: owner,
      authenticated: true,
      role: "owner",
      title: "MAX \u2014 Mmiliki Aliyeidhinishwa"
    });
  });
  app.put(["/api/auth/profile", "/api/me", "/api/user/profile"], (req, res) => {
    try {
      const updated = db.updateUser(DEFAULT_USER_ID, req.body);
      res.json({ success: true, user: updated, ...updated });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.post("/api/user/pin", (req, res) => {
    try {
      const { pin } = req.body;
      const updated = db.updateUser(DEFAULT_USER_ID, {
        securityPinSet: !!pin,
        securityPin: pin
      });
      res.json({ success: true, user: updated });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.post("/api/system/reset", (req, res) => {
    try {
      db.resetSystem();
      res.json({ success: true, message: "Mfumo umerejeshwa katika hali ya msingi." });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app.post(["/api/chat", "/api/chat/"], async (req, res) => {
    try {
      const { message = "", conversationId, conversationHistory = [], isVoice = false, attachments = [] } = req.body;
      if (!message && (!attachments || attachments.length === 0)) {
        return res.status(400).json({ error: "Ujumbe au kiambatisho kinahitajika" });
      }
      let effectiveHistory = Array.isArray(conversationHistory) && conversationHistory.length > 0 ? conversationHistory : [];
      if (effectiveHistory.length === 0 && conversationId) {
        const storedConv = db.getConversation(conversationId, DEFAULT_USER_ID);
        if (storedConv && Array.isArray(storedConv.messages)) {
          effectiveHistory = storedConv.messages;
        }
      }
      const result = await processMkuuChat({
        userId: DEFAULT_USER_ID,
        message,
        conversationHistory: effectiveHistory,
        isVoice,
        attachments
      });
      if (conversationId) {
        let conversation = db.getConversation(conversationId, DEFAULT_USER_ID);
        const userMsg = {
          id: `msg_${Date.now()}_u`,
          role: "user",
          content: message,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          isVoice,
          attachments: attachments.map((a) => ({
            filename: a.filename,
            fileType: a.fileType,
            mimeType: a.mimeType,
            size: a.size || 0,
            previewUrl: a.previewUrl || (a.base64Data?.startsWith("data:image/") ? a.base64Data : void 0)
          }))
        };
        const assistantMsg = {
          id: `msg_${Date.now()}_a`,
          role: "assistant",
          content: result.reply,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          generatedFiles: result.generatedFiles,
          memoryExtracted: result.memoriesExtracted?.map((m) => m.content),
          personRecognized: result.peopleRecognized?.map((p) => p.name)
        };
        if (conversation) {
          conversation.messages.push(userMsg, assistantMsg);
          db.saveConversation(conversation);
        } else {
          conversation = {
            id: conversationId,
            userId: DEFAULT_USER_ID,
            title: message.slice(0, 35) || "Mazungumzo Mapya",
            createdAt: (/* @__PURE__ */ new Date()).toISOString(),
            updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
            messages: [userMsg, assistantMsg]
          };
          db.saveConversation(conversation);
        }
      }
      res.json({
        reply: result.reply,
        cleanSpeechText: result.cleanSpeechText,
        memoriesExtracted: result.memoriesExtracted,
        peopleRecognized: result.peopleRecognized,
        generatedFiles: result.generatedFiles
      });
    } catch (error) {
      console.error("Chat API error:", error);
      res.status(500).json({ error: error.message || "Hitilafu ya seva" });
    }
  });
  app.get("/api/conversations", (req, res) => {
    const list = db.getConversations(DEFAULT_USER_ID);
    res.json(list);
  });
  app.get("/api/conversations/:id", (req, res) => {
    const conv = db.getConversation(req.params.id, DEFAULT_USER_ID);
    if (!conv) {
      return res.json({
        id: req.params.id,
        userId: DEFAULT_USER_ID,
        title: "Mazungumzo Mapya",
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        messages: []
      });
    }
    res.json(conv);
  });
  app.post("/api/conversations", (req, res) => {
    const { title = "Mazungumzo Mapya", messages = [] } = req.body;
    const newConv = {
      id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      userId: DEFAULT_USER_ID,
      title,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      messages
    };
    db.saveConversation(newConv);
    res.json(newConv);
  });
  app.delete("/api/conversations/:id", (req, res) => {
    const deleted = db.deleteConversation(req.params.id, DEFAULT_USER_ID);
    res.json({ success: deleted });
  });
  app.get("/api/memories", (req, res) => {
    const memories = db.getMemories(DEFAULT_USER_ID);
    res.json(memories);
  });
  app.post("/api/memories", (req, res) => {
    const { content, category = "General", importance = "medium", tags = [], source = "manual" } = req.body;
    if (!content) return res.status(400).json({ error: "Kumbukumbu inahitaji maelezo" });
    const newMem = db.addMemory({
      userId: DEFAULT_USER_ID,
      content,
      category,
      importance,
      tags,
      source
    });
    res.json(newMem);
  });
  const handleUpdateMemory = (req, res) => {
    const updated = db.updateMemory(req.params.id, DEFAULT_USER_ID, req.body);
    if (!updated) return res.status(404).json({ error: "Kumbukumbu haijapatikana" });
    res.json(updated);
  };
  app.put("/api/memories/:id", handleUpdateMemory);
  app.patch("/api/memories/:id", handleUpdateMemory);
  app.delete("/api/memories/:id", (req, res) => {
    const deleted = db.deleteMemory(req.params.id, DEFAULT_USER_ID);
    res.json({ success: deleted, message: "Kumbukumbu imefutwa kabisa kwenye database ya kudumu." });
  });
  app.get("/api/people", (req, res) => {
    const people = db.getPeople(DEFAULT_USER_ID);
    res.json(people);
  });
  app.post("/api/people", (req, res) => {
    const { name, nickname, relationship, phone, email, notes, avatarColor } = req.body;
    if (!name || !relationship) {
      return res.status(400).json({ error: "Jina na Uhusiano vinahitajika" });
    }
    const newPerson = db.addPerson({
      userId: DEFAULT_USER_ID,
      name,
      nickname,
      relationship,
      phone,
      email,
      notes,
      avatarColor: avatarColor || "blue"
    });
    res.json(newPerson);
  });
  const handleUpdatePerson = (req, res) => {
    const updated = db.updatePerson(req.params.id, DEFAULT_USER_ID, req.body);
    if (!updated) return res.status(404).json({ error: "Mtu hajapatikana" });
    res.json(updated);
  };
  app.put("/api/people/:id", handleUpdatePerson);
  app.patch("/api/people/:id", handleUpdatePerson);
  app.delete("/api/people/:id", (req, res) => {
    const deleted = db.deletePerson(req.params.id, DEFAULT_USER_ID);
    res.json({ success: deleted, message: "Mtu amefutwa kabisa kwenye database (Watu Wangu wa Karibu)." });
  });
  app.get("/api/autoreply/settings", (req, res) => {
    const settings = db.getAutoReplySettings(DEFAULT_USER_ID);
    res.json(settings);
  });
  const handleUpdateAutoReplySettings = (req, res) => {
    const updated = db.updateAutoReplySettings(DEFAULT_USER_ID, req.body);
    res.json(updated);
  };
  app.put("/api/autoreply/settings", handleUpdateAutoReplySettings);
  app.post("/api/autoreply/settings", handleUpdateAutoReplySettings);
  app.post("/api/autoreply/verify-phone", (req, res) => {
    const { phoneNumber } = req.body;
    if (!phoneNumber || !phoneNumber.trim()) {
      return res.status(400).json({ error: "Nambari ya simu inahitajika ili kuthibitishwa." });
    }
    const cleanPhone = phoneNumber.trim();
    const updated = db.updateAutoReplySettings(DEFAULT_USER_ID, {
      myPhoneNumber: cleanPhone,
      phoneVerified: true,
      phoneVerifiedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    res.json({
      success: true,
      message: `Nambari ${cleanPhone} imethibitishwa na kuunganishwa rasmi na mfumo wa Max Auto Reply.`,
      settings: updated
    });
  });
  app.post("/api/autoreply/remove-phone", (req, res) => {
    const updated = db.updateAutoReplySettings(DEFAULT_USER_ID, {
      myPhoneNumber: "",
      phoneVerified: false,
      phoneVerifiedAt: void 0
    });
    res.json({
      success: true,
      message: "Nambari ya simu imeondolewa kikamilifu kwenye Auto Reply.",
      settings: updated
    });
  });
  app.get("/api/autoreply/logs", (req, res) => {
    const logs = db.getAutoReplyLogs(DEFAULT_USER_ID);
    res.json(logs);
  });
  const handleClearLogs = (req, res) => {
    db.clearAutoReplyLogs(DEFAULT_USER_ID);
    res.json({ success: true, message: "Kumbukumbu zote za majibu ya kiotomatiki zimefutwa." });
  };
  app.delete("/api/autoreply/logs", handleClearLogs);
  app.post("/api/autoreply/logs/clear", handleClearLogs);
  app.post("/api/autoreply/simulate", async (req, res) => {
    try {
      const { sender, message, channel = "sms" } = req.body;
      if (!sender || !message) {
        return res.status(400).json({ error: "Nambari ya mtumaji na ujumbe vinahitajika" });
      }
      const log = await processInboundAutoReply({
        userId: DEFAULT_USER_ID,
        channel,
        sender,
        message,
        simulate: true
      });
      res.json({ success: true, log, ...log });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app.post("/api/sms/inbound", async (req, res) => {
    try {
      const { from, body, to } = req.body;
      const log = await processInboundAutoReply({
        userId: DEFAULT_USER_ID,
        channel: "sms",
        sender: from || "Unknown",
        message: body || "",
        recipient: to
      });
      res.json({ status: "success", logId: log.id, reply: log.generatedReply });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app.post("/api/autoreply/emergency-stop", (req, res) => {
    const current = db.getAutoReplySettings(DEFAULT_USER_ID);
    const stopVal = req.body?.stop !== void 0 ? req.body.stop : !current.emergencyStop;
    const updated = db.updateAutoReplySettings(DEFAULT_USER_ID, {
      emergencyStop: stopVal
    });
    res.json({ success: true, emergencyStop: updated.emergencyStop, settings: updated });
  });
  app.get("/api/files", (req, res) => {
    const files = db.getFiles(DEFAULT_USER_ID);
    res.json(files);
  });
  app.post("/api/files/generate", async (req, res) => {
    try {
      const { filename, fileType, title, content, contentPrompt, data, description } = req.body;
      if (!fileType || !content && !contentPrompt && !title) {
        return res.status(400).json({ error: "Aina ya faili na maelezo vinahitajika" });
      }
      const file = await generateRealFile({
        userId: DEFAULT_USER_ID,
        filename,
        fileType,
        title: title || filename || "Faili la Max",
        content: content || contentPrompt || title || "Taarifa za Max",
        data,
        description
      });
      res.json({ success: true, file, ...file });
    } catch (e) {
      console.error("File generation error:", e);
      res.status(500).json({ error: e.message || "Hitilafu wakati wa kuandaa faili" });
    }
  });
  app.get("/api/files/view/:id", (req, res) => {
    const { id } = req.params;
    const files = db.getFiles(DEFAULT_USER_ID);
    const file = files.find((f) => f.id === id);
    if (!file) {
      return res.status(404).send("Faili halikupatikana");
    }
    const diskPath = import_path3.default.join(FILES_DIR, `${file.id}_${file.filename}`);
    if (!import_fs3.default.existsSync(diskPath)) {
      return res.status(404).send("Faili halipo kwenye hifadhi ya diski");
    }
    res.setHeader("Content-Type", file.mimeType || "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(file.filename)}"`);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    const stream = import_fs3.default.createReadStream(diskPath);
    stream.pipe(res);
  });
  app.get("/api/files/download/:id", (req, res) => {
    const { id } = req.params;
    const files = db.getFiles(DEFAULT_USER_ID);
    const file = files.find((f) => f.id === id);
    if (!file) {
      return res.status(404).send("Faili halikupatikana");
    }
    const diskPath = import_path3.default.join(FILES_DIR, `${file.id}_${file.filename}`);
    if (!import_fs3.default.existsSync(diskPath)) {
      return res.status(404).send("Faili halipo kwenye hifadhi ya diski");
    }
    res.setHeader("Content-Type", file.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(file.filename)}"`);
    res.setHeader("Access-Control-Allow-Origin", "*");
    const stream = import_fs3.default.createReadStream(diskPath);
    stream.pipe(res);
  });
  app.get("/api/files/raw/:id", (req, res) => {
    const { id } = req.params;
    const files = db.getFiles(DEFAULT_USER_ID);
    const file = files.find((f) => f.id === id);
    if (!file) {
      return res.status(404).json({ error: "Faili halikupatikana" });
    }
    const diskPath = import_path3.default.join(FILES_DIR, `${file.id}_${file.filename}`);
    if (!import_fs3.default.existsSync(diskPath)) {
      return res.status(404).json({ error: "Faili halipo kwenye hifadhi" });
    }
    try {
      const buffer = import_fs3.default.readFileSync(diskPath);
      res.json({
        id: file.id,
        filename: file.filename,
        fileType: file.fileType,
        mimeType: file.mimeType,
        size: buffer.length,
        base64: buffer.toString("base64"),
        dataUrl: `data:${file.mimeType || "application/octet-stream"};base64,${buffer.toString("base64")}`
      });
    } catch (e) {
      res.status(500).json({ error: "Haikuweza kusoma faili" });
    }
  });
  app.delete("/api/files/:id", (req, res) => {
    const { id } = req.params;
    const deleted = db.deleteFile(id, DEFAULT_USER_ID);
    if (deleted) {
      res.json({ success: true, message: "Faili limefutwa kikamilifu." });
    } else {
      res.status(404).json({ success: false, error: "Faili halikupatikana au halikuweza kufutwa." });
    }
  });
  app.post("/api/files/upload", (req, res) => {
    try {
      const { filename, fileType, mimeType, base64Data, description } = req.body;
      if (!filename || !base64Data) {
        return res.status(400).json({ error: "Faili na data vinahitajika" });
      }
      const buffer = Buffer.from(base64Data.split(",")[1] || base64Data, "base64");
      const fileId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const diskFilename = `${fileId}_${filename}`;
      const diskPath = import_path3.default.join(FILES_DIR, diskFilename);
      import_fs3.default.writeFileSync(diskPath, buffer);
      let resolvedMimeType = mimeType || "application/octet-stream";
      const ext = filename.split(".").pop()?.toLowerCase() || "";
      if (ext === "pdf") resolvedMimeType = "application/pdf";
      else if (ext === "png") resolvedMimeType = "image/png";
      else if (ext === "jpg" || ext === "jpeg") resolvedMimeType = "image/jpeg";
      else if (ext === "webp") resolvedMimeType = "image/webp";
      else if (ext === "xlsx") resolvedMimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      else if (ext === "docx") resolvedMimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      else if (ext === "csv") resolvedMimeType = "text/csv";
      else if (ext === "json") resolvedMimeType = "application/json";
      else if (ext === "txt") resolvedMimeType = "text/plain";
      const fileRecord = {
        id: fileId,
        filename,
        fileType: fileType || ext || "txt",
        size: buffer.length,
        mimeType: resolvedMimeType,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        description: description || `Faili lililopakiwa na Max`,
        downloadUrl: `/api/files/download/${fileId}`
      };
      db.addFile(fileRecord);
      res.json(fileRecord);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app.get("/api/stats", (req, res) => {
    const memories = db.getMemories(DEFAULT_USER_ID);
    const people = db.getPeople(DEFAULT_USER_ID);
    const files = db.getFiles(DEFAULT_USER_ID);
    const logs = db.getAutoReplyLogs(DEFAULT_USER_ID);
    const settings = db.getAutoReplySettings(DEFAULT_USER_ID);
    res.json({
      totalMemories: memories.length,
      totalPeople: people.length,
      totalFiles: files.length,
      totalAutoReplies: logs.length,
      emergencyStop: settings.emergencyStop,
      autoReplyEnabled: settings.enabled,
      systemHealth: "100% Salama & Imeunganishwa",
      owner: "Max"
    });
  });
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `API route ${req.method} ${req.path} not found` });
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path3.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path3.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\u{1F451} MKUU AI Server is running on port ${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
