import React, { useState, useEffect } from 'react';
import { View, Button, StyleSheet, Text } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import { AUTH0_DOMAIN, AUTH0_CLIENT_ID } from '../auth';
import * as SecureStore from 'expo-secure-store';
import { red } from 'react-native-reanimated/lib/typescript/Colors';

export default function TabOneScreen() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null); 
  const [userInfo, setUserInfo] = useState<any>(null);
  const [loadingUserInfo, setLoadingUserInfo] = useState(false);

  const redirectUri = AuthSession.makeRedirectUri({ useProxy: true });
  console.log(redirectUri);
  const authUrl = `https://${AUTH0_DOMAIN}/authorize`;

  const [request, result, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: AUTH0_CLIENT_ID,
      redirectUri,
      responseType: 'code', // Authorization code flow
      scopes: ['openid', 'profile', 'email', 'offline_access'],
      usePKCE: true,
      extraParams: {
        audience: `https://${AUTH0_DOMAIN}/userinfo`,
      },
    },
    {
      authorizationEndpoint: authUrl,
      tokenEndpoint: `https://${AUTH0_DOMAIN}/oauth/token`,
    }
  );

  // Exchange authorization code for tokens
  useEffect(() => {
    const exchangeCodeAsync = async () => {
      if (result?.type === 'success' && result.params.code) {
        console.log('Authorization code received:', result.params.code);
        try {
          const code = result.params.code;

          // Exchange code for tokens
          const tokenResponse = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              grant_type: 'authorization_code',
              client_id: AUTH0_CLIENT_ID,
              code,
              redirect_uri: redirectUri,
              code_verifier: request.codeVerifier, // required for PKCE
            }),
          });

          console.log('Token response status:', tokenResponse.status);

          const tokenResult = await tokenResponse.json();
          console.log('Token exchange result:', tokenResult);
        

          if (tokenResult.access_token) {
            setAccessToken(tokenResult.access_token);
            await SecureStore.setItemAsync('access_token', tokenResult.access_token);
            fetchUserInfo(tokenResult.access_token);

          }
          // if (tokenResult.id_token) {
          //   setIdToken(tokenResult.id_token);
          //   await SecureStore.setItemAsync('id_token', tokenResult.id_token);
          // }
          else {
            console.error('Token exchange failed', tokenResult);
          }
        } catch (error) {
          console.error('Failed to exchange token:', error);
        }
      }
    };
    exchangeCodeAsync();
  }, [result]);

  const fetchUserInfo = async (token: string) => {
    setLoadingUserInfo(true);
    try {
      const response = await fetch(`https://${AUTH0_DOMAIN}/userinfo`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const user = await response.json();
      console.log(user);
      setUserInfo(user);
    } catch (error) {
      console.error('Failed to fetch user info:', error);
      setUserInfo(null);
    } finally {
      setLoadingUserInfo(false);
    }
  };

  const onLogout = async () => {
    setAccessToken(null);
    setUserInfo(null);
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('id_token');
  };

  return (
    <View style={styles.container}>
      {accessToken && userInfo ? (
        <>
          <Text style={styles.title}>Welcome, {userInfo.name || 'User'}</Text>
          <Button title="Logout" onPress={onLogout} />
        </>
      ) : (
        <>
          <Text style={styles.title}>Please log in</Text>
          <Button
            disabled={!request}
            title="Login with Auth0"
            onPress={() => promptAsync({ useProxy: true })}
          />
        </>
      )}
      {loadingUserInfo && <Text>Loading user info...</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 24, marginBottom: 20 },
});
