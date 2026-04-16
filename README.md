# FitPlan NZ

FitPlan NZ is a lightweight construction planning app for New Zealand fitout projects.

It includes:

- **Expo / React Native frontend** for mobile and web
- **FastAPI backend** with MongoDB
- NZ-aware workday logic including regions, holidays, and optional Saturday work
- Project templates, task sequencing, Gantt view, labour logging, and team tracking

## Project structure

```text
FitPlan NZ/
├── backend/
│   ├── server.py
│   ├── requirements.txt
│   └── tests/
└── frontend/
    ├── app/
    ├── components/
    ├── contexts/
    ├── app.json
    └── package.json
```

## Local setup

### Backend

1. Copy `backend/.env.example` to `backend/.env`
2. Install dependencies
3. Start the API

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn server:app --reload --port 8010
```

### Frontend

1. Copy `frontend/.env.example` to `frontend/.env`
2. Install dependencies
3. Start Expo

```bash
cd frontend
npm install
npm run start
```

By default the frontend expects the backend at `http://127.0.0.1:8010`.

## Environment files

### backend/.env

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=fitplan_nz
CORS_ORIGINS=http://localhost:8081,http://localhost:19006,http://127.0.0.1:19006,http://localhost:3000,http://127.0.0.1:3000
```

### frontend/.env

```env
EXPO_PUBLIC_BACKEND_URL=http://127.0.0.1:8010
```

If you want to test on a physical phone, replace the frontend backend URL with your computer's LAN IP address.

## GitHub push

```bash
git init
git branch -M main
git remote add origin https://github.com/dcljlong/FitPlan-NZ.git
git add .
git commit -m "Initial FitPlan NZ app cleanup"
git push -u origin main
```

## Notes

- Emergent-specific files and cached artifacts have been removed from this cleaned handoff.
- `node_modules`, local caches, repo metadata, and generated test reports are intentionally excluded from source control.
