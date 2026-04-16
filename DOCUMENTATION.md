### **6. Deployment Guide (Step-by-Step)**

#### **A. Backend Deployment (Render.com - Recommended)**
1. **Create Account**: Sign up at [Render.com](https://render.com) and connect your GitHub.
2. **New Web Service**: Click **New +** > **Web Service**.
3. **Select Repository**: Pick your `yummyfood` (or `yummy-backend`) repository.
4. **Configure Settings**:
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build` (Ensure you have a build script in `package.json`).
   - **Start Command**: `npm start` (Usually `node dist/app.js`).
5. **Environment Variables**:
   - Click the **Advanced** tab.
   - Add all variables from your `.env` (SUPABASE_URL, JWT_SECRET, etc.).
6. **Deploy**: Click **Create Web Service**. Render will give you a URL (e.g., `https://yummy-api.onrender.com`).
   - **Important**: Update your Frontend `axios.js` to use this new URL.

#### **B. Frontend Deployment (Vercel / Netlify)**
1. **Connect GitHub**: Log in to [Vercel](https://vercel.com) and click **Add New** > **Project**.
2. **Import Repo**: Select your project.
3. **Configure Project**:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `yummyfood` (if it's in a subfolder).
4. **Environment Variables**:
   - Add any frontend-specific variables (like `VITE_API_URL` pointing to your Render backend).
5. **Deploy**: Click **Deploy**. Vercel will provide your live website link.

#### **C. Supabase Production Check**
1. **API Keys**: Ensure your production `SUPABASE_URL` and `SUPABASE_ANON_KEY` are correct in both environments.
2. **CORS**: In Render/Backend settings, ensure your Frontend URL is allowed to make requests (update your CORS middleware if necessary).
3. **Storage**: Verify that the `receipts` bucket is public in the Supabase production dashboard.

---

### **7. Running Locally**
1. `npm install`
2. `npm run dev` (Starts with ts-node-dev for hot-reloading).

---

### **8. Security Policies (RLS)**
The system uses **Row Level Security** on Supabase:
- **Customers**: Can only `SELECT` their own records where `user_id = auth.uid()`.
- **Admins**: Can `SELECT` and `UPDATE` all records.
- **Backend**: Uses the `SERVICE_ROLE_KEY` to perform administrative overrides safely.

---

*Last Updated: 2024-04-16*
# 🍲 YummyFood Backend System Documentation

Welcome to the **YummyFood Backend** documentation. This system is a high-performance Node.js & TypeScript API designed to handle food orders, secure admin management, and automated payment proof processing using Supabase.

---

## **1. System Overview**
- **Language**: TypeScript (Node.js)
- **Framework**: Express.js
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage (Receipts bucket)
- **Auth**: Supabase Auth with custom JWT role-based access control (RBAC).

---

## **2. Folder Structure**
- `/config`: Database and third-party service initializations.
- `/controllers`: Business logic for handling requests (Auth, Orders, Payments).
- `/routes`: API endpoint definitions.
- `/middlewares`: Security guards (JWT verification, Admin checks).
- `/services`: Core logic reusable across controllers.
- `/supabse/migration`: SQL scripts for database schema setup.

---

## **3. Database Schema (Supabase)**

### **Profiles Table**
Stores user roles and metadata.
- `id`: UUID (linked to Auth.users)
- `email`: Text
- `role`: 'customer' | 'admin'
- `full_name`: Text

### **Orders Table**
Tracks food orders and their status.
- `id`: BIGINT (Primary Key)
- `user_id`: UUID (Foreign Key)
- `items`: JSONB (List of food items)
- `total_amount`: Numeric
- `status`: 'pending' | 'awaiting_confirmation' | 'completed'
- `receipt_url`: Text (Link to payment proof)

### **Payments Table**
Logs all submitted payment proofs.
- `order_id`: Text
- `amount`: Numeric
- `receipt_url`: Text

---

## **4. Authentication Flow**

### **Customer Signup**
1. User submits email/password.
2. Supabase Auth creates the user.
3. A record is automatically created in the `profiles` table with `role: 'customer'`.

### **Admin Registration**
1. Requires a valid `ADMIN_SECRET` environment variable.
2. Backend verifies the secret before granting the `admin` role in metadata.

### **Security (JWT)**
- Every protected request must include an `Authorization: Bearer <token>` header.
- The `auth.middleware.ts` decodes the token and attaches the `userId` and `role` to the request object.

---

## **5. Key API Endpoints**

### **Auth Routes (`/api/auth`)**
- `POST /signup`: Register a new user.
- `POST /signin`: Authenticate and receive a JWT.
- `POST /verify-otp`: Confirm email with 6-digit code.

### **Order Routes (`/api/orders`)**
- `GET /history`: Fetch personal order history (Customer).
- `GET /all`: Fetch all orders globally (**Admin Only**).

### **Payment Routes (`/api/payments`)**
- `POST /submit`: Upload a receipt image and link it to an order.
  - *Logic*: Uploads to Supabase Storage $\rightarrow$ Updates `payments` table $\rightarrow$ Updates `orders` status.

---

## **6. Setup & Deployment**

### **Environment Variables (.env)**
```env
PORT=5000
SUPABASE_URL=your_project_url
SUPABASE_ANON_KEY=your_public_key
SUPABASE_SERVICE_ROLE_KEY=your_secret_key (Required for Admin bypass)
JWT_SECRET=your_jwt_secret
ADMIN_SECRET=your_admin_signup_secret
```

### **Running Locally**
1. `npm install`
2. `npm run dev` (Starts with ts-node-dev for hot-reloading).

### **Production Deployment**
- Recommended host: **Render** or **Railway**.
- Ensure all environment variables are added to the cloud dashboard.
- Set `NODE_ENV=production`.

---

## **7. Security Policies (RLS)**
The system uses **Row Level Security** on Supabase:
- **Customers**: Can only `SELECT` their own records where `user_id = auth.uid()`.
- **Admins**: Can `SELECT` and `UPDATE` all records.
- **Backend**: Uses the `SERVICE_ROLE_KEY` to perform administrative overrides safely.

---

*Last Updated: 2024-04-16*