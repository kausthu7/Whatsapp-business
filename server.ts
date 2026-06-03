import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { 
  Tenant, UserProfile, Contact, Conversation, 
  Message, Workflow, WorkflowNode, Campaign, WhatsAppTemplate 
} from "./src/types";
import { GoogleGenAI } from "@google/genai";
import * as dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const dbPath = path.resolve(process.cwd(), "database_db.json");

class SimulatedDatabase {
  tenants: Tenant[] = [
    {
      id: "org_alpha",
      name: "Alpha Retailers Group",
      metaAppId: "987654321012345",
      phoneNumberId: "phone_wa_9918",
      businessAccountId: "waba_acc_7718",
      systemToken: "EAAGxx89128...EA881920"
    },
    {
      id: "org_beta",
      name: "Apex Logistics Tech",
      metaAppId: "123456789098765",
      phoneNumberId: "phone_wa_4412",
      businessAccountId: "waba_acc_3312",
      systemToken: "EAAGaa82718...EE112233"
    }
  ];

  currentUser: UserProfile = {
    id: "user_agent_1",
    name: "Alex Mercer",
    email: "alex@company.com",
    role: "Admin",
    organizationId: "org_alpha"
  };

  contacts: Contact[] = [
    {
      id: "cont_1",
      name: "Devon Lane",
      phoneNumber: "+15550198274",
      organizationId: "org_alpha",
      labels: ["VIP", "Active Customer"],
      attributes: { "PreferredCategory": "Electronics", "City": "San Francisco", "VIPTier": "Platinum" },
      notes: "Met at Trade Fair. Interested in high-bulk wholesale setup.",
      assignedAgentId: "user_agent_1",
      currentNodeId: undefined
    },
    {
      id: "cont_2",
      name: "Cody Fisher",
      phoneNumber: "+15550138923",
      organizationId: "org_alpha",
      labels: ["Lead", "High Intent"],
      attributes: { "PreferredCategory": "Fashion", "City": "New York" },
      notes: "Submitted form on landing page requesting wholesale catalog.",
      assignedAgentId: undefined,
      currentNodeId: undefined
    },
    {
      id: "cont_3",
      name: "Kristin Watson",
      phoneNumber: "+447700900077",
      organizationId: "org_alpha",
      labels: ["Support Pending"],
      attributes: { "City": "London" },
      notes: "Requires quick help with order validation.",
      assignedAgentId: "user_agent_1",
      currentNodeId: undefined
    }
  ];

  conversations: Conversation[] = [
    {
      id: "conv_1",
      contactId: "cont_1",
      organizationId: "org_alpha",
      status: "Open",
      assignedAgentId: "user_agent_1",
      lastMessageAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      unreadCount: 0
    },
    {
      id: "conv_2",
      contactId: "cont_2",
      organizationId: "org_alpha",
      status: "Pending",
      assignedAgentId: undefined,
      lastMessageAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
      unreadCount: 2
    },
    {
      id: "conv_3",
      contactId: "cont_3",
      organizationId: "org_alpha",
      status: "Resolved",
      assignedAgentId: "user_agent_1",
      lastMessageAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      unreadCount: 0
    }
  ];

  messages: Message[] = [
    {
      id: "msg_1",
      conversationId: "conv_1",
      direction: "Incoming",
      type: "Text",
      content: "Hi there! I am interested in ordering 100 units of your Smart Charger.",
      status: "Read",
      timestamp: new Date(Date.now() - 40 * 60 * 1000).toISOString()
    },
    {
      id: "msg_2",
      conversationId: "conv_1",
      direction: "Outgoing",
      type: "Text",
      content: "Hello Devon! Glad to assist you. Let me check the wholesale tier prices for Smart Chargers.",
      status: "Read",
      timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString()
    },
    {
      id: "msg_3",
      conversationId: "conv_2",
      direction: "Incoming",
      type: "Text",
      content: "Is anyone available? I clicked custom buttons in the workflow.",
      status: "Delivered",
      timestamp: new Date(Date.now() - 3.2 * 3600 * 1000).toISOString()
    },
    {
      id: "msg_4",
      conversationId: "conv_2",
      direction: "Incoming",
      type: "Interactive",
      content: "Selected Option: View Catalog",
      status: "Delivered",
      timestamp: new Date(Date.now() - 3 * 3600 * 1000).toISOString()
    }
  ];

  // In-memory queues for broadcasts (Simulating high performance BullMQ throttling backend)
  campaigns: Campaign[] = [
    {
      id: "camp_1",
      organizationId: "org_alpha",
      name: "Wholesale Launch Alert 2026",
      templateName: "wholesale_launch",
      status: "Completed",
      sentCount: 154,
      deliveredCount: 152,
      readCount: 121,
      failedCount: 2,
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "camp_2",
      organizationId: "org_alpha",
      name: "Product Restock Flash",
      templateName: "restock_notice",
      status: "Processing",
      sentCount: 42,
      deliveredCount: 38,
      readCount: 29,
      failedCount: 0,
      createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString()
    }
  ];

  // Pre-approved templates matching Meta account credentials
  templates: WhatsAppTemplate[] = [
    {
      name: "wholesale_launch",
      category: "MARKETING",
      language: "en_US",
      components: [
        { type: "HEADER", text: "🚀 Wholesale Alert!" },
        { type: "BODY", text: "Hello {{1}}, our wholesale collection has just been updated with high-bulk pricing for {{2}}. Click below to purchase." },
        { type: "FOOTER", text: "Meta Verified Partner" },
        { type: "BUTTONS", buttons: [{ type: "URL", text: "Buy Now" }] }
      ]
    },
    {
      name: "restock_notice",
      category: "UTILITY",
      language: "en_US",
      components: [
        { type: "HEADER", text: "⚡ Restock Warning" },
        { type: "BODY", text: "Hi {{1}}, we're happy to let you know that {{2}} is officially back in stock! Order within 24 hours to secure." },
        { type: "FOOTER", text: "Auto Alert System" }
      ]
    },
    {
      name: "welcome_onboarding",
      category: "UTILITY",
      language: "en_US",
      components: [
        { type: "BODY", text: "Hello {{1}}! Thanks for registering with us. How can we support your digital commerce growth helper today?" }
      ]
    }
  ];

  // Visual Directed Acyclic Graphs JSON schema matching PostgreSQL persistence
  workflows: Workflow[] = [
    {
      id: "flow_lead_qualified",
      organizationId: "org_alpha",
      name: "Automated Onboarding & Lead Routing",
      description: "Triggered on primary keywords (hi, hello, menu). Identifies customer intent, answers FAQs, or routes to direct human support inbox.",
      isActive: true,
      nodes: [
        {
          id: "node_1",
          type: "Trigger",
          title: "Primary Key Matcher",
          config: { keyword: "hello" },
          position: { x: 50, y: 150 }
        },
        {
          id: "node_2",
          type: "SendMessage",
          title: "Send Onboarding Intro",
          config: { text: "Thank you for reaching out! 🌟 Please select an option to guide your request:" },
          position: { x: 280, y: 150 }
        },
        {
          id: "node_3",
          type: "Interactive",
          title: "Intent Request Buttons",
          config: {
            buttons: ["📦 Track Order", "💼 Wholesale Deals", "💬 Talk to Support"],
            branches: [
              { condition: "Track Order", nextNodeId: "node_track" },
              { condition: "Wholesale Deals", nextNodeId: "node_deal" },
              { condition: "Talk to Support", nextNodeId: "node_human" }
            ],
            fallbackNodeId: "node_fallback"
          },
          position: { x: 520, y: 150 }
        },
        {
          id: "node_track",
          type: "SendMessage",
          title: "Track Order Guide",
          config: { text: "To track your order, please log in to our catalog portal at: https://alpha.digital/portal. Need further details?" },
          position: { x: 800, y: 30 }
        },
        {
          id: "node_deal",
          type: "SendMessage",
          title: "Send Wholesale Sheet",
          config: { text: "Amazing! 🏷️ Our bulk wholesale spreadsheet is dispatched. Our tier prices start from batches of 50+. Please submit premium orders on alex@company.com." },
          position: { x: 800, y: 200 }
        },
        {
          id: "node_human",
          type: "AssignHuman",
          title: "Inbox Dispatcher",
          config: { assigneeRole: "Support" },
          position: { x: 800, y: 380 }
        },
        {
          id: "node_fallback",
          type: "SendMessage",
          title: "Fallback Apology",
          config: { text: "We didn't quite capture that choice. Connecting you with our support department immediately!" },
          position: { x: 740, y: 550 }
        }
      ]
    }
  ];

  // Helper properties
  queueJobs: { id: string; campaignId: string; phone: string; progress: number; status: string }[] = [];
}

const db = new SimulatedDatabase();
if (fs.existsSync(dbPath)) {
  const saved = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
  Object.assign(db, saved);
}
function saveDb() {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), "utf-8");
}

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // Real-time Queue runner mockup (BullMQ replication for campaigns)
  setInterval(() => {
    const processingCamp = db.campaigns.find(c => c.status === "Processing");
    if (processingCamp) {
      const remaining = 200 - (processingCamp.sentCount);
      if (remaining > 0) {
        const step = Math.min(remaining, Math.floor(Math.random() * 8) + 2);
        processingCamp.sentCount += step;
        processingCamp.deliveredCount += Math.floor(step * 0.95);
        processingCamp.readCount += Math.floor(step * 0.7);
        processingCamp.failedCount += Math.floor(step * 0.05);

        if (processingCamp.sentCount >= 200) {
          processingCamp.sentCount = 200;
          processingCamp.status = "Completed";
        }
      }
    }
  }, 4000);

  // 1. TENANCY & SECURITY API Rules
  app.get("/api/tenants", (req, res) => {
    res.json(db.tenants);
  });

  app.put("/api/tenants/:id", (req, res) => {
    const { id } = req.params;
    const index = db.tenants.findIndex(t => t.id === id);
    if (index !== -1) {
      db.tenants[index] = { ...db.tenants[index], ...req.body };
      res.json(db.tenants[index]);
    } else {
      res.status(404).json({ error: "Tenant not found" });
    }
  });

  app.get("/api/me", (req, res) => {
    res.json(db.currentUser);
  });

  app.put("/api/me/role", (req, res) => {
    const { role } = req.body;
    db.currentUser.role = role || db.currentUser.role;
    res.json(db.currentUser);
  });

  // 2. CONTACTS CRM API
  app.get("/api/contacts", (req, res) => {
    res.json(db.contacts);
  });

  app.post("/api/contacts", (req, res) => {
    const newContact: Contact = {
      id: `cont_${Date.now()}`,
      organizationId: db.currentUser.organizationId,
      notes: "",
      labels: [],
      attributes: {},
      ...req.body
    };
    db.contacts.push(newContact);
    res.status(201).json(newContact);
  });

  app.put("/api/contacts/:id", (req, res) => {
    const { id } = req.params;
    const index = db.contacts.findIndex(c => c.id === id);
    if (index !== -1) {
      db.contacts[index] = { ...db.contacts[index], ...req.body };
      res.json(db.contacts[index]);
    } else {
      res.status(404).json({ error: "Contact not found" });
    }
  });

  // 3. OMNICHANNEL CHAT & REAL-TIME WEBHOOK ENGINE
  app.get("/api/conversations", (req, res) => {
    res.json(db.conversations);
  });

  app.put("/api/conversations/:id/assign", (req, res) => {
    const { id } = req.params;
    const { agentId } = req.body;
    const index = db.conversations.findIndex(c => c.id === id);
    if (index !== -1) {
      db.conversations[index].assignedAgentId = agentId;
      res.json(db.conversations[index]);
    } else {
      res.status(404).json({ error: "Conversation not found" });
    }
  });

  app.put("/api/conversations/:id/status", (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const index = db.conversations.findIndex(c => c.id === id);
    if (index !== -1) {
      db.conversations[index].status = status;
      res.json(db.conversations[index]);
    } else {
      res.status(404).json({ error: "Conversation not found" });
    }
  });

  app.get("/api/messages/:convId", (req, res) => {
    const { convId } = req.params;
    const filtered = db.messages.filter(m => m.conversationId === convId);
    res.json(filtered);
  });

  // Direct send message endpoint
  app.post("/api/messages", (req, res) => {
    const { conversationId, content, type, templateName, templateParameters } = req.body;
    const newMsg: Message = {
      id: `msg_${Date.now()}`,
      conversationId,
      direction: "Outgoing",
      type: type || "Text",
      content,
      templateName,
      templateParameters,
      status: "Sent",
      timestamp: new Date().toISOString()
    };
    db.messages.push(newMsg);

    // Simulate real-time Meta reaction (Sent -> Delivered -> Read status transition)
    setTimeout(() => {
      newMsg.status = "Delivered";
    }, 1500);
    setTimeout(() => {
      newMsg.status = "Read";
    }, 3000);

    // Update conversation last message timestamp
    const cIdx = db.conversations.findIndex(c => c.id === conversationId);
    if (cIdx !== -1) {
      db.conversations[cIdx].lastMessageAt = newMsg.timestamp;
    }

    res.status(201).json(newMsg);
  });

  // SIMULATE META CUSTOMER WEBHOOK TRAFFIC (Real-time integration testing)
  app.post("/api/webhook/simulate", (req, res) => {
    const { contactId, text } = req.body;
    const contact = db.contacts.find(c => c.id === contactId);
    if (!contact) {
      return res.status(404).json({ error: "Contact not found" });
    }

    // Find or create conversation
    let conversation = db.conversations.find(c => c.contactId === contactId);
    if (!conversation) {
      conversation = {
        id: `conv_${Date.now()}`,
        contactId,
        organizationId: contact.organizationId,
        status: "Open",
        lastMessageAt: new Date().toISOString(),
        unreadCount: 1
      };
      db.conversations.push(conversation);
    } else {
      conversation.unreadCount += 1;
      conversation.lastMessageAt = new Date().toISOString();
    }

    // Add Incoming message
    const incomingMsg: Message = {
      id: `incoming_${Date.now()}`,
      conversationId: conversation.id,
      direction: "Incoming",
      type: "Text",
      content: text,
      status: "Read",
      timestamp: new Date().toISOString()
    };
    db.messages.push(incomingMsg);

    // Automation runtime triggers
    const activeWorkflow = db.workflows.find(w => w.isActive && w.organizationId === contact.organizationId);
    const lowercaseText = text.trim().toLowerCase();

    // Log tracking for server logs representation
    console.log(`[Webhook Event] Message incoming matching contact ${contact.id}. Automator checking logic...`);

    if (activeWorkflow) {
      const currentId = contact.currentNodeId;
      let nextNode: WorkflowNode | undefined;

      if (!currentId) {
        // Look for trigger matches (Entry stage)
        const triggerNode = activeWorkflow.nodes.find(n => n.type === 'Trigger');
        if (triggerNode && triggerNode.config.keyword && lowercaseText.includes(triggerNode.config.keyword.toLowerCase())) {
          // Transition to first state output
          nextNode = activeWorkflow.nodes.find(n => n.id === "node_2"); // Onboarding text
        }
      } else {
        // We're actively inside a workflow interaction branch
        const currentNode = activeWorkflow.nodes.find(n => n.id === currentId);
        if (currentNode) {
          if (currentNode.type === "Interactive" && currentNode.config.branches) {
            // Check button match text
            const branch = currentNode.config.branches.find(b => 
              lowercaseText === b.condition.toLowerCase() || 
              lowercaseText.includes(b.condition.toLowerCase())
            );
            if (branch) {
              nextNode = activeWorkflow.nodes.find(n => n.id === branch.nextNodeId);
            } else {
              // Try fallback Node
              if (currentNode.config.fallbackNodeId) {
                nextNode = activeWorkflow.nodes.find(n => n.id === currentNode.config.fallbackNodeId);
              }
            }
          } else {
            // Default sequential link
            const index = activeWorkflow.nodes.findIndex(n => n.id === currentId);
            if (index !== -1 && index + 1 < activeWorkflow.nodes.length) {
              nextNode = activeWorkflow.nodes[index + 1];
            }
          }
        }
      }

      // If next node was found, dispatch automation payload!
      if (nextNode) {
        contact.currentNodeId = nextNode.id;

        // Auto-reply event
        if (nextNode.type === "SendMessage" && nextNode.config.text) {
          setTimeout(() => {
            const botReply: Message = {
              id: `auto_${Date.now()}`,
              conversationId: conversation.id,
              direction: "Outgoing",
              type: "Text",
              content: nextNode.config.text,
              status: "Read",
              timestamp: new Date().toISOString()
            };
            db.messages.push(botReply);

            // If the next node is sequential static output (like node_3 interactive button option right after intro), auto trigger it
            if (nextNode.id === "node_2") {
              contact.currentNodeId = "node_3"; // Advance state
            }
          }, 1200);
        } else if (nextNode.type === "Interactive" && nextNode.config.text) {
          setTimeout(() => {
            const botReply: Message = {
              id: `auto_${Date.now()}`,
              conversationId: conversation.id,
              direction: "Outgoing",
              type: "Interactive",
              content: `${nextNode.config.text || "Please Choose: "}\nOptions:\n${nextNode.config.buttons?.map(b => `[${b}]`).join('\n')}`,
              status: "Read",
              timestamp: new Date().toISOString()
            };
            db.messages.push(botReply);
          }, 1200);
        } else if (nextNode.type === "AssignHuman") {
          contact.currentNodeId = undefined; // Halt bot state
          conversation.status = "Open";
          conversation.assignedAgentId = "user_agent_1"; // Auto Assign

          setTimeout(() => {
            const systemNotice: Message = {
              id: `sys_notify_${Date.now()}`,
              conversationId: conversation.id,
              direction: "Outgoing",
              type: "Text",
              content: "🔔 Dynamic flow finished. You are now routed to supportive customer service.",
              status: "Read",
              timestamp: new Date().toISOString()
            };
            db.messages.push(systemNotice);
          }, 1000);
        }
      }
    }

    res.json({ success: true, conversationId: conversation.id });
  });

  // 4. AUTOMATION VISUAL CANVAS DAG SCHEMA persist
  app.get("/api/workflows", (req, res) => {
    res.json(db.workflows);
  });

  app.put("/api/workflows/:id", (req, res) => {
    const { id } = req.params;
    const index = db.workflows.findIndex((w: any) => w.id === id);
    if (index !== -1) {
      db.workflows[index] = { ...db.workflows[index], ...req.body };
      saveDb();
      res.json(db.workflows[index]);
    } else {
      res.status(404).json({ error: "Workflow not found" });
    }
  });

  // 5. CAMPAIGNS BROADCAST & TEMPLATES API
  app.get("/api/campaigns", (req, res) => {
    res.json(db.campaigns);
  });

  app.post("/api/campaigns", (req, res) => {
    const newCampaign: Campaign = {
      id: `camp_${Date.now()}`,
      organizationId: db.currentUser.organizationId,
      status: "Scheduled",
      sentCount: 0,
      deliveredCount: 0,
      readCount: 0,
      failedCount: 0,
      createdAt: new Date().toISOString(),
      ...req.body
    };
    db.campaigns.push(newCampaign);
    res.status(201).json(newCampaign);
  });

  app.post("/api/campaigns/:id/launch", (req, res) => {
    const { id } = req.params;
    const campaign = db.campaigns.find(c => c.id === id);
    if (campaign) {
      campaign.status = "Processing";
      campaign.sentCount = 5;
      campaign.deliveredCount = 4;
      campaign.readCount = 2;
      res.json(campaign);
    } else {
      res.status(404).json({ error: "Campaign not found" });
    }
  });

  app.get("/api/templates", (req, res) => {
    res.json(db.templates);
  });

  // 6. AI WORKFLOW GENERATOR
  app.post("/api/ai/generate-workflow", async (req, res) => {
    try {
      const { prompt } = req.body;
      
      // Fallback mock generation if API key is not configured locally
      if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY') {
        console.log("No valid GEMINI_API_KEY found, using mock AI generation.");
        const mockNodes = [
          {
            id: "node_1",
            type: "Trigger",
            title: "Incoming Keyword",
            config: { keyword: "help" },
            position: { x: 250, y: 50 }
          },
          {
            id: "node_2",
            type: "SendMessage",
            title: "Greeting & Options",
            config: { text: "Hi there! I'm your AI assistant. How can I help you today?" },
            position: { x: 250, y: 200 }
          },
          {
            id: "node_3",
            type: "Interactive",
            title: "Action Selection",
            config: {
              text: "Please choose an option:",
              buttons: ["Track Order", "Speak to Human"],
              branches: [
                { condition: "Track Order", nextNodeId: "node_4" },
                { condition: "Speak to Human", nextNodeId: "node_5" }
              ]
            },
            position: { x: 250, y: 350 }
          },
          {
            id: "node_4",
            type: "SendMessage",
            title: "Provide Tracking",
            config: { text: "Your order is on the way! Track it here: https://link.to/track" },
            position: { x: 50, y: 550 }
          },
          {
            id: "node_5",
            type: "AssignHuman",
            title: "Agent Handoff",
            config: { assigneeRole: "Support" },
            position: { x: 450, y: 550 }
          }
        ];
        
        // Add a slight delay to simulate AI thought process
        res.json({ success: true, nodes: mockNodes });
        return;
      }

      const ai = new GoogleGenAI({});
      
      const systemPrompt = `You are an expert AI that generates visual workflow automation schemas for a chat bot system.
The user will describe what they want the bot to do. You must generate a JSON array of nodes that represent this workflow.

Available node types: 'Trigger', 'SendMessage', 'Interactive', 'AssignHuman'.
Each node must have this structure:
{
  "id": "node_1", // unique string
  "type": "Trigger", // or SendMessage, Interactive, AssignHuman
  "title": "Display Title",
  "config": {
     // depending on type:
     // Trigger: { "keyword": "trigger word" }
     // SendMessage: { "text": "message content" }
     // Interactive: { "text": "prompt", "buttons": ["Yes", "No"], "branches": [{ "condition": "Yes", "nextNodeId": "node_yes" }, { "condition": "No", "nextNodeId": "node_no" }] }
     // AssignHuman: { "assigneeRole": "Support" }
  },
  "position": { "x": 100, "y": 100 } // You must provide reasonable layout coordinates (e.g. going down by y + 150 each step, branching left/right by x +/- 200).
}
Return ONLY the JSON array of nodes. No markdown, no explanation.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          temperature: 0.2
        }
      });
      
      if (response.text) {
        const nodes = JSON.parse(response.text);
        res.json({ success: true, nodes });
      } else {
        res.status(500).json({ error: "Failed to generate workflow" });
      }
    } catch (error: any) {
      console.error("AI Generation Error:", error?.message || error);
      res.status(500).json({ error: "AI generation failed. Missing API Key or invalid prompt." });
    }
  });

  // Serve static UI React assets via Vite in development
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express app hosted on Port ${PORT}`);
  });
}

startServer();
