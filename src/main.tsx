import React from "react";
import ReactDOM from "react-dom/client";
import { Authenticator } from '@aws-amplify/ui-react';
import App from "./App.tsx";
import "./index.css";
import '@aws-amplify/ui-react/styles.css';
import { Amplify } from "aws-amplify";
import outputs from "../amplify_outputs.json";

Amplify.configure(outputs);

ReactDOM.createRoot(document.getElementById("root")!).render(   
  <React.StrictMode>
    <Authenticator
      loginMechanisms={['email']}
      signUpAttributes={['email']}
      socialProviders={[]}
      hideSignUp={false}
      components={{
        Header() {
          return (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <h1 style={{ color: '#9C0F00', margin: '0 0 10px 0', fontFamily: 'Inder, sans-serif' }}>Wlcome to Iris</h1>
              <p style={{ color: '#666', margin: '0', fontFamily: 'Inder, sans-serif' }}>Iris Demo</p>
            </div>
          );
        },
        Footer() {
          return (
            <div style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
              <p>© 2024 Iris Demo App</p>
            </div>
          );
        }
      }}
    >
      <App />
    </Authenticator>
  </React.StrictMode>
);
