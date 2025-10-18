import React from "react";
import ReactDOM from "react-dom/client";
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import App from "./App.tsx";
import "./index.css";
import "./login.css";
import { Amplify } from "aws-amplify";
import outputs from "../amplify_outputs.json";

Amplify.configure(outputs);

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
        Create An Account
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
        Back to Login
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
