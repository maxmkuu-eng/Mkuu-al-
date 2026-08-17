import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { db, FILES_DIR } from './server/db.js';
import { processMkuuChat } from './server/gemini.js';
import { generateRealFile, ensureInitialSeedFiles } from './server/files.js';
import { processInboundAutoReply } from './server/autoreply.js';

async function startServer() {
  const app = express();

  // Cloud Run provides PORT. Local development defaults to 8080.
  const PORT = Number(process.env.PORT || 8080);

  // Initialize initial seed files if vault is clean
  await ensureInitialSeedFiles();

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Middleware to attach authenticated owner
  const DEFAULT_USER_ID = 'user_max_owner';

  // ==========================================
  // AUTH & PROFILE APIS
  // ==========================================
  app.get(['/api/me', '/api/auth/me', '/api/user'], (req, res) => {
    const owner = db.getOwner();

    res.json({
      ...owner,
      user: owner,
      authenticated: true,
      role: 'owner',
      title: 'MAX — Mmiliki Aliyeidhinishwa',
    });
  });

  app.put(['/api/auth/profile', '/api/me', '/api/user/profile'], (req, res) => {
    try {
      const updated = db.updateUser(DEFAULT_USER_ID, req.body);

      res.json({
        success: true,
        user: updated,
        ...updated,
      });
    } catch (e: any) {
      res.status(400).json({
        error: e.message,
      });
    }
  });

  app.post('/api/user/pin', (req, res) => {
    try {
      const { pin } = req.body;

      const updated = db.updateUser(DEFAULT_USER_ID, {
        securityPinSet: !!pin,
        securityPin: pin,
      });

      res.json({
        success: true,
        user: updated,
      });
    } catch (e: any) {
      res.status(400).json({
        error: e.message,
      });
    }
  });

  app.post('/api/system/reset', (req, res) => {
    try {
      db.resetSystem();

      res.json({
        success: true,
        message: 'Mfumo umerejeshwa katika hali ya msingi.',
      });
    } catch (e: any) {
      res.status(500).json({
        error: e.message,
      });
    }
  });

  // ==========================================
  // CHAT & PERSONAL PIPELINE APIS
  // ==========================================
  app.post('/api/chat', async (req, res) => {
    try {
      const {
        message = '',
        conversationId,
        conversationHistory = [],
        isVoice = false,
        attachments = [],
      } = req.body;

      if (!message && (!attachments || attachments.length === 0)) {
        return res.status(400).json({
          error: 'Ujumbe au kiambatisho kinahitajika',
        });
      }

      const result = await processMkuuChat({
        userId: DEFAULT_USER_ID,
        message,
        conversationHistory,
        isVoice,
        attachments,
      });

      // Update conversation in database if conversationId provided
      if (conversationId) {
        let conversation = db.getConversation(
          conversationId,
          DEFAULT_USER_ID
        );

        const userMsg = {
          id: `msg_${Date.now()}_u`,
          role: 'user' as const,
          content: message,
          timestamp: new Date().toISOString(),
          isVoice,

          attachments: attachments.map((a: any) => ({
            filename: a.filename,
            fileType: a.fileType,
            mimeType: a.mimeType,
            size: a.size || 0,
            previewUrl:
              a.previewUrl ||
              (a.base64Data?.startsWith('data:image/')
                ? a.base64Data
                : undefined),
          })),
        };

        const assistantMsg = {
          id: `msg_${Date.now()}_a`,
          role: 'assistant' as const,
          content: result.reply,
          timestamp: new Date().toISOString(),
          generatedFiles: result.generatedFiles,
          memoryExtracted: result.memoriesExtracted?.map(
            (m) => m.content
          ),
          personRecognized: result.peopleRecognized?.map(
            (p) => p.name
          ),
        };

        if (conversation) {
          conversation.messages.push(userMsg, assistantMsg);
          db.saveConversation(conversation);
        } else {
          conversation = {
            id: conversationId,
            userId: DEFAULT_USER_ID,
            title: message.slice(0, 35) || 'Mazungumzo Mapya',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            messages: [userMsg, assistantMsg],
          };

          db.saveConversation(conversation);
        }
      }

      res.json({
        reply: result.reply,
        cleanSpeechText: result.cleanSpeechText,
        memoriesExtracted: result.memoriesExtracted,
        peopleRecognized: result.peopleRecognized,
        generatedFiles: result.generatedFiles,
      });
    } catch (error: any) {
      console.error('Chat API error:', error);

      res.status(500).json({
        error: error.message || 'Hitilafu ya seva',
      });
    }
  });

  // ==========================================
  // CONVERSATIONS
  // ==========================================
  app.get('/api/conversations', (req, res) => {
    const list = db.getConversations(DEFAULT_USER_ID);

    res.json(list);
  });

  app.get('/api/conversations/:id', (req, res) => {
    const conv = db.getConversation(
      req.params.id,
      DEFAULT_USER_ID
    );

    if (!conv) {
      return res.json({
        id: req.params.id,
        userId: DEFAULT_USER_ID,
        title: 'Mazungumzo Mapya',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [],
      });
    }

    res.json(conv);
  });

  app.post('/api/conversations', (req, res) => {
    const {
      title = 'Mazungumzo Mapya',
      messages = [],
    } = req.body;

    const newConv = {
      id: `conv_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 6)}`,
      userId: DEFAULT_USER_ID,
      title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages,
    };

    db.saveConversation(newConv);

    res.json(newConv);
  });

  app.delete('/api/conversations/:id', (req, res) => {
    const deleted = db.deleteConversation(
      req.params.id,
      DEFAULT_USER_ID
    );

    res.json({
      success: deleted,
    });
  });

  // ==========================================
  // MAX MEMORY APIS
  // ==========================================
  app.get('/api/memories', (req, res) => {
    const memories = db.getMemories(DEFAULT_USER_ID);

    res.json(memories);
  });

  app.post('/api/memories', (req, res) => {
    const {
      content,
      category = 'General',
      importance = 'medium',
      tags = [],
      source = 'manual',
    } = req.body;

    if (!content) {
      return res.status(400).json({
        error: 'Kumbukumbu inahitaji maelezo',
      });
    }

    const newMem = db.addMemory({
      userId: DEFAULT_USER_ID,
      content,
      category,
      importance,
      tags,
      source,
    });

    res.json(newMem);
  });

  const handleUpdateMemory = (req: any, res: any) => {
    const updated = db.updateMemory(
      req.params.id,
      DEFAULT_USER_ID,
      req.body
    );

    if (!updated) {
      return res.status(404).json({
        error: 'Kumbukumbu haijapatikana',
      });
    }

    res.json(updated);
  };

  app.put('/api/memories/:id', handleUpdateMemory);
  app.patch('/api/memories/:id', handleUpdateMemory);

  app.delete('/api/memories/:id', (req, res) => {
    const deleted = db.deleteMemory(
      req.params.id,
      DEFAULT_USER_ID
    );

    res.json({
      success: deleted,
      message:
        'Kumbukumbu imefutwa kabisa kwenye database ya kudumu.',
    });
  });

  // ==========================================
  // MAX IDENTIFY & WATU WANGU WA KARIBU APIS
  // ==========================================
  app.get('/api/people', (req, res) => {
    const people = db.getPeople(DEFAULT_USER_ID);

    res.json(people);
  });

  app.post('/api/people', (req, res) => {
    const {
      name,
      nickname,
      relationship,
      phone,
      email,
      notes,
      avatarColor,
    } = req.body;

    if (!name || !relationship) {
      return res.status(400).json({
        error: 'Jina na Uhusiano vinahitajika',
      });
    }

    const newPerson = db.addPerson({
      userId: DEFAULT_USER_ID,
      name,
      nickname,
      relationship,
      phone,
      email,
      notes,
      avatarColor: avatarColor || 'blue',
    });

    res.json(newPerson);
  });

  const handleUpdatePerson = (req: any, res: any) => {
    const updated = db.updatePerson(
      req.params.id,
      DEFAULT_USER_ID,
      req.body
    );

    if (!updated) {
      return res.status(404).json({
        error: 'Mtu hajapatikana',
      });
    }

    res.json(updated);
  };

  app.put('/api/people/:id', handleUpdatePerson);
  app.patch('/api/people/:id', handleUpdatePerson);

  app.delete('/api/people/:id', (req, res) => {
    const deleted = db.deletePerson(
      req.params.id,
      DEFAULT_USER_ID
    );

    res.json({
      success: deleted,
      message:
        'Mtu amefutwa kabisa kwenye database (Watu Wangu wa Karibu).',
    });
  });

  // ==========================================
  // MAX AUTO REPLY APIS
  // ==========================================
  app.get('/api/autoreply/settings', (req, res) => {
    const settings = db.getAutoReplySettings(
      DEFAULT_USER_ID
    );

    res.json(settings);
  });

  const handleUpdateAutoReplySettings = (
    req: any,
    res: any
  ) => {
    const updated = db.updateAutoReplySettings(
      DEFAULT_USER_ID,
      req.body
    );

    res.json(updated);
  };

  app.put(
    '/api/autoreply/settings',
    handleUpdateAutoReplySettings
  );

  app.post(
    '/api/autoreply/settings',
    handleUpdateAutoReplySettings
  );

  // Verify Phone Number
  app.post('/api/autoreply/verify-phone', (req, res) => {
    const { phoneNumber } = req.body;

    if (!phoneNumber || !phoneNumber.trim()) {
      return res.status(400).json({
        error:
          'Nambari ya simu inahitajika ili kuthibitishwa.',
      });
    }

    const cleanPhone = phoneNumber.trim();

    const updated = db.updateAutoReplySettings(
      DEFAULT_USER_ID,
      {
        myPhoneNumber: cleanPhone,
        phoneVerified: true,
        phoneVerifiedAt: new Date().toISOString(),
      }
    );

    res.json({
      success: true,
      message: `Nambari ${cleanPhone} imethibitishwa na kuunganishwa rasmi na mfumo wa Max Auto Reply.`,
      settings: updated,
    });
  });

  // Remove Phone Number
  app.post('/api/autoreply/remove-phone', (req, res) => {
    const updated = db.updateAutoReplySettings(
      DEFAULT_USER_ID,
      {
        myPhoneNumber: '',
        phoneVerified: false,
        phoneVerifiedAt: undefined,
      }
    );

    res.json({
      success: true,
      message:
        'Nambari ya simu imeondolewa kikamilifu kwenye Auto Reply.',
      settings: updated,
    });
  });

  app.get('/api/autoreply/logs', (req, res) => {
    const logs = db.getAutoReplyLogs(DEFAULT_USER_ID);

    res.json(logs);
  });

  const handleClearLogs = (req: any, res: any) => {
    db.clearAutoReplyLogs(DEFAULT_USER_ID);

    res.json({
      success: true,
      message:
        'Kumbukumbu zote za majibu ya kiotomatiki zimefutwa.',
    });
  };

  app.delete(
    '/api/autoreply/logs',
    handleClearLogs
  );

  app.post(
    '/api/autoreply/logs/clear',
    handleClearLogs
  );

  // Inbound SMS Webhook & Simulation
  app.post('/api/autoreply/simulate', async (req, res) => {
    try {
      const {
        sender,
        message,
        channel = 'sms',
      } = req.body;

      if (!sender || !message) {
        return res.status(400).json({
          error:
            'Nambari ya mtumaji na ujumbe vinahitajika',
        });
      }

      const log = await processInboundAutoReply({
        userId: DEFAULT_USER_ID,
        channel,
        sender,
        message,
        simulate: true,
      });

      res.json({
        success: true,
        log,
        ...log,
      });
    } catch (e: any) {
      res.status(500).json({
        error: e.message,
      });
    }
  });

  app.post('/api/sms/inbound', async (req, res) => {
    try {
      const {
        from,
        body,
        to,
      } = req.body;

      const log = await processInboundAutoReply({
        userId: DEFAULT_USER_ID,
        channel: 'sms',
        sender: from || 'Unknown',
        message: body || '',
        recipient: to,
      });

      res.json({
        status: 'success',
        logId: log.id,
        reply: log.generatedReply,
      });
    } catch (e: any) {
      res.status(500).json({
        error: e.message,
      });
    }
  });

  // Emergency stop trigger
  app.post(
    '/api/autoreply/emergency-stop',
    (req, res) => {
      const current =
        db.getAutoReplySettings(DEFAULT_USER_ID);

      const stopVal =
        req.body?.stop !== undefined
          ? req.body.stop
          : !current.emergencyStop;

      const updated =
        db.updateAutoReplySettings(
          DEFAULT_USER_ID,
          {
            emergencyStop: stopVal,
          }
        );

      res.json({
        success: true,
        emergencyStop: updated.emergencyStop,
        settings: updated,
      });
    }
  );

  // ==========================================
  // REAL FILES & DOWNLOAD ENGINE APIS
  // ==========================================
  app.get('/api/files', (req, res) => {
    const files = db.getFiles(DEFAULT_USER_ID);

    res.json(files);
  });

  app.post('/api/files/generate', async (req, res) => {
    try {
      const {
        filename,
        fileType,
        title,
        content,
        contentPrompt,
        data,
        description,
      } = req.body;

      if (
        !fileType ||
        (!content && !contentPrompt && !title)
      ) {
        return res.status(400).json({
          error:
            'Aina ya faili na maelezo vinahitajika',
        });
      }

      const file = await generateRealFile({
        userId: DEFAULT_USER_ID,
        filename,
        fileType,
        title:
          title ||
          filename ||
          'Faili la Max',
        content:
          content ||
          contentPrompt ||
          title ||
          'Taarifa za Max',
        data,
        description,
      });

      res.json({
        success: true,
        file,
        ...file,
      });
    } catch (e: any) {
      console.error(
        'File generation error:',
        e
      );

      res.status(500).json({
        error:
          e.message ||
          'Hitilafu wakati wa kuandaa faili',
      });
    }
  });

  // View file inline
  app.get('/api/files/view/:id', (req, res) => {
    const { id } = req.params;

    const files =
      db.getFiles(DEFAULT_USER_ID);

    const file = files.find(
      (f) => f.id === id
    );

    if (!file) {
      return res.status(404).send(
        'Faili halikupatikana'
      );
    }

    const diskPath = path.join(
      FILES_DIR,
      `${file.id}_${file.filename}`
    );

    if (!fs.existsSync(diskPath)) {
      return res.status(404).send(
        'Faili halipo kwenye hifadhi ya diski'
      );
    }

    res.setHeader(
      'Content-Type',
      file.mimeType ||
        'application/pdf'
    );

    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(
        file.filename
      )}"`
    );

    res.setHeader(
      'Access-Control-Allow-Origin',
      '*'
    );

    res.setHeader(
      'Cross-Origin-Resource-Policy',
      'cross-origin'
    );

    const stream =
      fs.createReadStream(diskPath);

    stream.pipe(res);
  });

  // Download file as attachment
  app.get(
    '/api/files/download/:id',
    (req, res) => {
      const { id } = req.params;

      const files =
        db.getFiles(DEFAULT_USER_ID);

      const file = files.find(
        (f) => f.id === id
      );

      if (!file) {
        return res.status(404).send(
          'Faili halikupatikana'
        );
      }

      const diskPath = path.join(
        FILES_DIR,
        `${file.id}_${file.filename}`
      );

      if (!fs.existsSync(diskPath)) {
        return res.status(404).send(
          'Faili halipo kwenye hifadhi ya diski'
        );
      }

      res.setHeader(
        'Content-Type',
        file.mimeType ||
          'application/octet-stream'
      );

      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(
          file.filename
        )}"`
      );

      res.setHeader(
        'Access-Control-Allow-Origin',
        '*'
      );

      const stream =
        fs.createReadStream(diskPath);

      stream.pipe(res);
    }
  );

  // Get raw file base64 / text content
  app.get(
    '/api/files/raw/:id',
    (req, res) => {
      const { id } = req.params;

      const files =
        db.getFiles(DEFAULT_USER_ID);

      const file = files.find(
        (f) => f.id === id
      );

      if (!file) {
        return res.status(404).json({
          error:
            'Faili halikupatikana',
        });
      }

      const diskPath = path.join(
        FILES_DIR,
        `${file.id}_${file.filename}`
      );

      if (!fs.existsSync(diskPath)) {
        return res.status(404).json({
          error:
            'Faili halipo kwenye hifadhi',
        });
      }

      try {
        const buffer =
          fs.readFileSync(diskPath);

        res.json({
          id: file.id,
          filename: file.filename,
          fileType: file.fileType,
          mimeType: file.mimeType,
          size: buffer.length,
          base64:
            buffer.toString('base64'),
          dataUrl:
            `data:${file.mimeType || 'application/octet-stream'};base64,${buffer.toString('base64')}`,
        });
      } catch (e: any) {
        res.status(500).json({
          error:
            'Haikuweza kusoma faili',
        });
      }
    }
  );

  app.delete('/api/files/:id', (req, res) => {
    const { id } = req.params;

    const deleted = db.deleteFile(
      id,
      DEFAULT_USER_ID
    );

    if (deleted) {
      res.json({
        success: true,
        message:
          'Faili limefutwa kikamilifu.',
      });
    } else {
      res.status(404).json({
        success: false,
        error:
          'Faili halikupatikana au halikuweza kufutwa.',
      });
    }
  });

  // Upload/Process Document or Image
  app.post(
    '/api/files/upload',
    (req, res) => {
      try {
        const {
          filename,
          fileType,
          mimeType,
          base64Data,
          description,
        } = req.body;

        if (!filename || !base64Data) {
          return res.status(400).json({
            error:
              'Faili na data vinahitajika',
          });
        }

        const buffer = Buffer.from(
          base64Data.split(',')[1] ||
            base64Data,
          'base64'
        );

        const fileId =
          `upload_${Date.now()}_${Math.random()
            .toString(36)
            .substr(2, 6)}`;

        const diskFilename =
          `${fileId}_${filename}`;

        const diskPath = path.join(
          FILES_DIR,
          diskFilename
        );

        fs.writeFileSync(
          diskPath,
          buffer
        );

        // Determine proper mimeType
        let resolvedMimeType =
          mimeType ||
          'application/octet-stream';

        const ext =
          filename
            .split('.')
            .pop()
            ?.toLowerCase() || '';

        if (ext === 'pdf') {
          resolvedMimeType =
            'application/pdf';
        } else if (ext === 'png') {
          resolvedMimeType
