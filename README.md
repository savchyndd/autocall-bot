# Autocall-bot

## Getting Started

### Install Dependencies

First, clone the repository and install the required packages:

```bash
git clone <repository-url>
cd <project-directory>
npm install
```

## Environment Variables Configuration

Your .env file should contain the following variables:

### SIP Configuration

- SIP_DOMAIN: The domain of your SIP server.
- SIP_WS_SERVER: WebSocket URL of your SIP server to handle SIP messages.
- SIP_URI: Unique SIP URI for registering with the server.
- SIP_PASSWORD: Password for authentication on the SIP server.
- SIP_DISPLAY_NAME: The display name that will be shown during calls.
- SIP_INTERNAL_NUMBER: Internal number used for identification.
- SIP_LOGIN: Login used to register on the SIP server.

## Running the Project

To run the project in development mode (with automatic restarts on code changes):

```
npm run dev
```

To run the project in production mode:

```
npm start
```

## API

To initiate a call, provide the target phone number using a POST request to /api/call.

Example Request:

```
POST /api/call
Content-Type: application/json

{
  "target": "123456789"
}
```

Example Response:
Successful response:

```
{
  "message": "Call to 123456789 ended."
}
```

Error response:

```
{
  "error": "Call failed: <reason>"
}
```
