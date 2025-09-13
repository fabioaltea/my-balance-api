# MyBalance

**MyBalance** is a personal finance tracker designed for spreadsheet enthusiasts.  
It allows you to record expenses, incomes, and asset distribution across multiple accounts — while keeping **all data stored in your own Google Sheet**.  

Unlike traditional finance apps, MyBalance gives you:  
- **Full control**: data stays in your Google Sheets, not on a third-party server.  
- **Flexibility**: perform custom calculations, charts, or analyses directly in Sheets.  
- **Modern UX**: a sleek, intuitive interface built for control freaks who love spreadsheets but want a better way to interact with their data.  

The system is divided into two parts: a **React + Ionic PWA frontend** and an **Express.js backend** connected to Google Sheets and PostgreSQL.  

---

## ⚙️ Backend (Express + Google Sheets API + PostgreSQL)

The backend is powered by **Express.js**, acting as the middleware between the frontend and **Google Sheets API**, ensuring secure and reliable communication.  

- **Stack**: Node.js + Express  
- **Data source**: Google Sheets (user-owned, all data stored directly in the user’s sheet)  
- **Authentication**:  
  - **SimpleWebAuthn** for WebAuthn-based authentication  
  - **Google OAuth access tokens** for secure Google Sheets access  
- **Database**: PostgreSQL, used for system-level metadata and app configuration (not for storing user financial data)  
- **Hosting**: deployed on **Vercel**  

The backend ensures all requests to Google Sheets are authenticated and authorized, while maintaining a lightweight system database for application state and user/session management.  

👉 Frontend repo: [mybalance-ionic](https://github.com/fabioaltea/my-balance-ionic)  
