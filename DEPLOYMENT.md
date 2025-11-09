# Backend Deployment Guide

This guide provides step-by-step instructions for deploying the Node.js backend service on your Linux server with Nginx and Virtualmin.

## Prerequisites

1.  **SSH Access:** You must have SSH access to your Linux server.
2.  **Node.js & npm:** Node.js (version 18 or higher) and npm must be installed. You can check by running `node -v` and `npm -v`. If they aren't installed, you can use a tool like `nvm` (Node Version Manager) to easily install them.
3.  **Git:** Git should be installed on your server (`git --version`).

---

## Step 1: Clone the Repository

First, connect to your server via SSH. Then, clone your repository to a suitable location, such as `/home/your_username/apps`.

```bash
# Navigate to your desired directory
cd /home/your_username/apps

# Clone the repository
git clone <your_repository_url>
cd <your_repository_directory>
```

---

## Step 2: Install Dependencies

Navigate to the `server` directory and install the required Node.js packages.

```bash
cd server
npm install --production
```
This command only installs the necessary production dependencies, keeping the installation lean.

---

## Step 3: Configure Environment Variables

The backend requires environment variables to store sensitive information like your OpenAI API key.

1.  **Create a `.env` file** by copying the example file:
    ```bash
    cp .env.example .env
    ```

2.  **Edit the `.env` file** using a text editor like `nano` or `vim`:
    ```bash
    nano .env
    ```

3.  **Update the following values:**
    *   `OPENAI_API_KEY`: Paste your secret OpenAI API key here. This is the most critical step.
    *   `PORT`: You can leave this as `3000` or change it to another available port.
    *   `EXTENSION_ID`: Enter your Chrome Extension's ID here. You can find this in Chrome by navigating to `chrome://extensions`, enabling "Developer mode," and copying the ID. This is important for security (CORS).
    *   `NODE_ENV`: Set this to `production`.

    Save and close the file (in `nano`, press `Ctrl+X`, then `Y`, then `Enter`).

---

## Step 4: Run the Application with a Process Manager

To ensure the backend runs continuously, even if the server reboots, you should use a process manager like **PM2**.

1.  **Install PM2 globally:**
    ```bash
    npm install pm2 -g
    ```

2.  **Start the application with PM2:**
    ```bash
    # From within the /server directory
    pm2 start dist/index.js --name "clarifier-backend"
    ```

3.  **Set up PM2 to start on server reboot:**
    ```bash
    pm2 startup
    ```
    This will generate a command that you need to copy and run.

4.  **Save the current process list:**
    ```bash
    pm2 save
    ```

Your backend is now running and will restart automatically. You can check its status with `pm2 list`.

---

## Step 5: Configure Nginx as a Reverse Proxy

The final step is to configure Nginx to forward incoming traffic to your Node.js application. This allows you to access it via a standard domain name (e.g., `https://api.yourdomain.com`) with HTTPS.

You can do this easily through your **Virtualmin panel**:

1.  **Log in to Virtualmin.**
2.  **Select the domain** you want to use for the API (e.g., create a new subdomain like `api.yourdomain.com`).
3.  Go to **Services -> Proxy Pass -> Add a new proxy pass**.
4.  **Configure the proxy pass:**
    *   **Location:** `/` (this means all traffic to this subdomain will be proxied).
    *   **Proxy to URL:** `http://localhost:3000` (or whatever port you configured in your `.env` file).
5.  **Enable SSL:** Make sure your domain has SSL enabled in Virtualmin (usually handled by Let's Encrypt) to serve traffic over HTTPS.

Nginx will now securely route requests from your domain to the running Node.js application.

---

## Step 6: Update Chrome Extension API Endpoint

Finally, you need to tell your Chrome extension where to find the new backend.

1.  **Open the extension code.**
2.  Navigate to the **Options page** of the extension (or wherever the API base URL is configured).
3.  Change the API base URL to your new domain: `https://api.yourdomain.com`.

After redeploying your extension with this change, it will communicate with your secure, self-hosted backend.
