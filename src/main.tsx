import React from "react";
import ReactDOM from "react-dom/client";
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import App from "./App.tsx";
import "./index.css";
import "./login.css";
import { Amplify } from "aws-amplify";
// No local amplify_outputs.json dependency; resolve from window/env instead

function resolveAmplifyConfig(): any | null {
  try {
    const win: any = typeof window !== 'undefined' ? (window as any) : undefined;
    const env: any = (import.meta as any)?.env || {};

    // Prefer injected outputs (production-like)
    const fromWindow = win?.amplify_outputs;
    if (fromWindow && typeof fromWindow === 'object') {
      return {
        ...fromWindow,
        version: String(fromWindow.version ?? '1'),
      };
    }

    // Build from Vite env (local)
    const region = env.VITE_AWS_REGION || env.VITE_AWS_COGNITO_REGION;
    const userPoolId = env.VITE_USER_POOL_ID || env.VITE_USER_POOLS_ID;
    const userPoolClientId = env.VITE_USER_POOL_CLIENT_ID || env.VITE_USER_POOLS_WEB_CLIENT_ID;
    const functionUrl = env.VITE_FUNCTION_URL_OVERRIDE;

    if (region && userPoolId && userPoolClientId) {
      return {
        version: '1',
        auth: {
          // Provide both key styles to satisfy different Amplify expectations
          aws_region: region,
          user_pool_id: userPoolId,
          user_pool_client_id: userPoolClientId,
          aws_cognito_region: region,
          aws_user_pools_id: userPoolId,
          aws_user_pools_web_client_id: userPoolClientId,
        },
        custom: functionUrl ? { backendFunctionUrl: functionUrl } : undefined,
      };
    }

    // 3) Final fallback: known dev values so local works without .env.local
    // Safe to commit (not secrets): region, pool id, client id
    return {
      version: '1',
      auth: {
        aws_region: 'us-east-1',
        user_pool_id: 'us-east-1_ruWI3olPY',
        user_pool_client_id: '3q65j6m8am20846757pu7v3i54',
        aws_cognito_region: 'us-east-1',
        aws_user_pools_id: 'us-east-1_ruWI3olPY',
        aws_user_pools_web_client_id: '3q65j6m8am20846757pu7v3i54',
      },
    };
  } catch {}
  return null;
}

const resolvedConfig = resolveAmplifyConfig();
if (resolvedConfig) {
  Amplify.configure(resolvedConfig as any);
} else {
  console.warn('[Amplify] No configuration found. Provide window.amplify_outputs or .env.local with VITE_AWS_REGION, VITE_USER_POOL_ID, VITE_USER_POOL_CLIENT_ID.');
}

function LoginHeader() {
  const { toSignUp } = useAuthenticator();
  
  return (
    <div style={{ 
      position: 'absolute', 
      top: '24px', 
      right: '24px', 
      zIndex: 100 
    }}>
      <button
        onClick={toSignUp}
        style={{
          background: 'none',
          border: 'none',
          fontWeight: 600,
          color: '#333',
          cursor: 'pointer',
          fontSize: '14px',
          padding: 0
        }}
      >
        Create an account
      </button>
    </div>
  );
}

function SignUpHeader() {
  const { toSignIn } = useAuthenticator();
  
  return (
    <div style={{ 
      position: 'absolute', 
      top: '24px', 
      right: '24px', 
      zIndex: 100 
    }}>
      <button
        onClick={toSignIn}
        style={{
          background: 'none',
          border: 'none',
          fontWeight: 600,
          color: '#333',
          cursor: 'pointer',
          fontSize: '14px',
          padding: 0
        }}
      >
        Back to login
      </button>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(   
  <React.StrictMode>
    <Authenticator
      loginMechanisms={['email']}
      signUpAttributes={['email']}
      socialProviders={[]}
      hideSignUp={false}
      components={{
        SignIn: {
          Header: LoginHeader,
          Footer() {
            return null;
          }
        },
        SignUp: {
          Header: SignUpHeader,
          Footer() {
            return null;
          }
        }
      }}
    >
      {({ user }) => (
        user ? <App /> : <div>Loading...</div>
      )}
    </Authenticator>
  </React.StrictMode>
);
