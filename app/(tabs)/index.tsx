import React, { useState, useEffect, useRef } from "react";
import { View, Button, StyleSheet, Text, SafeAreaView, TouchableOpacity, FlatList, StatusBar, ActivityIndicator } from "react-native";
import * as AuthSession from "expo-auth-session";
import { AUTH0_DOMAIN, AUTH0_CLIENT_ID } from "../auth.ts";
import * as SecureStore from "expo-secure-store";
import { WebView } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';

// Mini app configurations
const MINI_APPS = [
  { id: 'login', name: 'Login Mini App', url: 'http://192.168.0.102:3000' },
  { id: 'movies', name: 'Movie Search Mini App', url: 'https://your-movie-search.vercel.app' },
  { id: 'profile', name: 'User Profile Mini App', url: 'https://your-profile-miniapp.vercel.app' },
];

export default function TabOneScreen() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [loadingUserInfo, setLoadingUserInfo] = useState(false);
  const [currentAppId, setCurrentAppId] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const webviewRef = useRef(null);

  const redirectUri = AuthSession.makeRedirectUri({ useProxy: true });
  const authUrl = `https://${AUTH0_DOMAIN}/authorize`;

  const [request, result, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: AUTH0_CLIENT_ID,
      redirectUri,
      responseType: "code",
      scopes: ["openid", "profile", "email", "offline_access"],
      usePKCE: true,
    },
    {
      authorizationEndpoint: authUrl,
      tokenEndpoint: `https://${AUTH0_DOMAIN}/oauth/token`,
    }
  );

  // Function to exchange refresh token for session transfer token
  const exchangeRefreshTokenForSessionToken = async (refreshToken: string) => {
    try {
      const response = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "refresh_token",
          client_id: AUTH0_CLIENT_ID,
          refresh_token: refreshToken,
        }),
      });

      const data = await response.json();
      if (data.access_token) {
        return data.access_token;
      } else {
        throw new Error("No access token received");
      }
    } catch (error) {
      console.error("Error exchanging refresh token:", error);
      return null;
    }
  };

  // Exchange authorization code for tokens and fetch user info
  useEffect(() => {
    const exchangeCodeAsync = async () => {
      if (result?.type === "success" && result.params.code) {
        try {
          const code = result.params.code;

          const tokenResponse = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              grant_type: "authorization_code",
              client_id: AUTH0_CLIENT_ID,
              code,
              redirect_uri: redirectUri,
              code_verifier: request.codeVerifier, // PKCE code_verifier
            }),
          });

          const tokenResult = await tokenResponse.json();
          if (tokenResult.access_token) {
            setAccessToken(tokenResult.access_token);
            await SecureStore.setItemAsync("access_token", tokenResult.access_token);
            fetchUserInfo(tokenResult.access_token);
          }
        } catch (error) {
          console.error("Error exchanging authorization code:", error);
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
      setUserInfo(user);
    } catch (error) {
      console.error("Error fetching user info:", error);
      setUserInfo(null);
    } finally {
      setLoadingUserInfo(false);
    }
  };

  const onMessage = async (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log("web-data", data);
      if (data.type === "AUTH_SUCCESS") {
        await SecureStore.setItemAsync("sessionToken", data.token);
        setAccessToken(data.token);
        alert("authentication successfully")
      }
    } catch (e) {
      console.error("Failed to parse message from WebView:", e);
    }
  };

  const onLogout = async () => {
    try {
      // Clear session tokens from SecureStore and localStorage
      await SecureStore.deleteItemAsync("access_token");
      await SecureStore.deleteItemAsync("sessionToken");
      await SecureStore.deleteItemAsync("id_token");
      await SecureStore.deleteItemAsync("refresh_token");
      
      // localStorage.removeItem('sessionToken'); // Clear from localStorage
  
      // If using Google Auth, sign out the user from Google
      if (window.gapi && window.gapi.auth2) {
        const auth2 = window.gapi.auth2.getAuthInstance();
        await auth2.signOut().then(() => {
          console.log("Signed out of Google");
        });
      }
  
      // If using Firebase, call the Firebase signOut method
      if (window.firebase) {
        await window.firebase.auth().signOut();
        console.log("Signed out of Firebase");
      }
  
      // Optionally notify user with an alert or UI change
      alert("Logged out successfully");
  
      // Update state to reflect logged-out status
      setAccessToken(null);
      setUserInfo(null);
    } catch (error) {
      console.error("Logout failed:", error);
      alert("An error occurred while logging out.");
    }
  };
  

  // UI: Login or redirect based on access token
  if (!accessToken) {
    return (
      <LinearGradient colors={["#a8edea", "#fed6e3"]} style={styles.gradient}>
        <SafeAreaView style={styles.container}>
          <Text style={styles.title}>Please log in</Text>
          <Button disabled={!request} title="Login with Auth0" onPress={() => promptAsync({ useProxy: true })} />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // UI: Display mini app selector after successful login
  if (!currentAppId) {
    return (
      <LinearGradient colors={['#a8edea', '#fed6e3']} style={styles.gradient}>
        <SafeAreaView style={styles.container}>
          <Text style={styles.header}>Select a Mini App</Text>
          <FlatList
            data={MINI_APPS}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.appItem}
                onPress={() => setCurrentAppId(item.id)}
              >
                <Text style={styles.appName}>{item.name}</Text>
              </TouchableOpacity>
            )}
          />
              {accessToken && userInfo && <Text style={styles.title}>Welcome, {userInfo.name || 'User'}</Text>}
              <Button title="Logout" onPress={onLogout} />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // UI: Show WebView for the selected mini app
  const currentApp = MINI_APPS.find((app) => app.id === currentAppId);

  return (
    <View style={styles.container}>
      {accessToken && userInfo ? (
        <>
          <LinearGradient colors={["#a8edea", "#fed6e3"]} style={styles.gradient}>
            <StatusBar barStyle="dark-content" backgroundColor="#a8edea" />
            <SafeAreaView style={{ flex: 1 }}>
              <View style={styles.navBar}>
                <TouchableOpacity onPress={() => setCurrentAppId(null)} style={styles.backButton}>
                  <Text style={styles.backButtonText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.navTitle}>{currentApp.name}</Text>
              </View>
              <WebView
                ref={webviewRef}
                originWhitelist={["*"]}
                source={{
                  uri: `${currentApp.url}?token=${encodeURIComponent(accessToken || "")}`,
                }}
                onMessage={onMessage}
                injectedJavaScript={`
                  window.authToken = "${accessToken}";
                  true;
                `}
                style={styles.webview}
              />
            </SafeAreaView>
            
          </LinearGradient>
        </>
      ) : (
        <>
          <Text style={styles.title}>Please log in</Text>
          <Button disabled={!request} title="Login with Auth0" onPress={() => promptAsync({ useProxy: true })} />
        </>
      )}
      {loadingUserInfo && <ActivityIndicator size="large" color="#0000ff" />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: { fontSize: 24, marginBottom: 20 },
  gradient: { flex: 1 },
  header: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 16,
    textAlign: "center",
    color: "#333",
  },
  appItem: {
    padding: 16,
    backgroundColor: "#fff",
    marginVertical: 8,
    borderRadius: 12,
    elevation: 3,
  },
  appName: {
    fontSize: 20,
    color: "#2b5876",
    fontWeight: "600",
  },
  navBar: {
    height: 56,
    backgroundColor: "#2b5876",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: "#fff",
    fontSize: 18,
  },
  navTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
    marginLeft: 16,
  },
  webview: {
    flex: 1,
  },
});
