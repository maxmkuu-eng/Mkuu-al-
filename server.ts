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
      message: `Nambari ${cleanPhone} imethibitishwa na kuunganish
