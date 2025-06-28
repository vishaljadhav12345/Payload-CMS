# 🧠 Dynamic Workflow Management System (Payload CMS)

This project is a custom Payload CMS setup for managing dynamic workflows such as approvals, reviews, and audit trails, built using Node.js, TypeScript, and MongoDB.

---

## 📦 Project Features

- ✅ Custom collections: Users, Workflows, Workflow Logs, Products, Blogs, Contracts
- ✅ Embedded WorkflowPanel (React) for step-based UI
- ✅ REST API to programmatically advance workflows
- ✅ Admin interface via Payload CMS
- ✅ MongoDB-based data persistence

---

## 🚀 How to Run the Project

### 1. Clone or Extract the Project
Unzip the file and navigate into the project folder:
```bash
cd payload-workflow-project
```

### 2. Install Dependencies
Make sure Node.js (v16+) is installed, then run:
```bash
npm install
```

### 3. Set Up MongoDB
- Install MongoDB locally (https://www.mongodb.com/try/download/community)
- OR use MongoDB Atlas and update the connection string in `.env`

### 4. Rename and Configure Environment File
Rename `payload.env` to `.env` and set:
```env
DATABASE_URI=mongodb://localhost:27017/payloadcms
PAYLOAD_SECRET=someSuperSecret123
```

### 5. Run the Dev Server
```bash
npx payload dev
```

### 6. Access the Admin Dashboard
Open your browser:
```
http://localhost:3000/admin
```

Create your admin user and begin using the dashboard.

---

## 🛠 Project Structure

```
├── payload.config.ts
├── evaluateAndAdvanceWorkflow.ts
├── Users.ts
├── Workflows.ts
├── WorkflowLogs.ts
├── components/
│   └── WorkflowPanel.tsx
├── collections/
│   ├── Products.ts
│   ├── Blogs.ts
│   └── Contracts.ts
├── package.json
├── .env
```

---

## 📬 API Endpoint
Advance a workflow via API:
```
POST /api/workflows/:id/advance
```

---

## 🧪 Tech Stack

- Payload CMS
- MongoDB
- TypeScript
- React (for admin UI)
