# Deployment Instructions

You can run this addon locally on your computer using either **Docker** (recommended) or **Node.js** directly.

## Option 1: Docker (Recommended)
This method ensures the addon runs in an isolated environment and restarts automatically.

1.  **Install Docker Desktop** for Windows if you haven't already.
2.  Open a terminal in this folder.
3.  Run:
    ```powershell
    docker-compose up -d
    ```
4.  The addon will be running at `http://localhost:3000`.

## Option 2: Node.js Direct
1.  Open a terminal in this folder.
2.  Install dependencies:
    ```powershell
    npm install
    ```
3.  Start the server:
    ```powershell
    npm start
    ```
4.  The addon will be running at `http://localhost:3000`.

## Adding to Stremio
1.  Open Stremio on your computer.
2.  Go to the **Addons** search bar.
3.  Paste the Manifest URL:
    *   If Stremio is on the **same computer**: `http://localhost:3000/manifest.json`
    *   If Stremio is on a **different device** (Phone/TV) on the same Wi-Fi:
        1.  Find your computer's local IP address (run `ipconfig` in terminal, look for IPv4 Address, e.g., `192.168.1.15`).
        2.  Use `http://192.168.1.15:3000/manifest.json`.

## Solving "HTTPS Required" (Stremio Web)

Stremio Web (`web.stremio.com`) **requires** a valid HTTPS connection. You have two options:

### Option A: Ngrok (Easiest & Recommended)
This creates a temporary public HTTPS URL that tunnels to your computer. Stremio will accept this immediately.

1.  Download [Ngrok](https://ngrok.com/download) and sign up for a free account.
2.  Open a terminal and run:
    ```powershell
    ngrok http 3000
    ```
3.  Copy the `https://...ngrok-free.app` URL provided.
4.  Add `/manifest.json` to the end (e.g., `https://1234-56-78.ngrok-free.app/manifest.json`) and paste that into Stremio.

### Option B: Caddy (Local HTTPS)
I have configured Caddy in the `docker-compose.yml` to provide local HTTPS.

1.  Run `docker-compose up -d`.
2.  Your addon is now available at `https://YOUR_LOCAL_IP/manifest.json` (e.g., `https://192.168.1.15/manifest.json`).
3.  **Important:** Since this uses a self-signed certificate, your browser or Stremio might warn you that it is "Not Secure". You may need to manually visit the URL in your browser first and click "Proceed (Unsafe)" to accept the certificate before Stremio can see it.

