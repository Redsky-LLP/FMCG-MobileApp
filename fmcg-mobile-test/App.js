import React, { useState } from 'react';
import { StatusBar, SafeAreaView, StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

export default function App() {
  const [loading, setLoading] = useState(true);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      
      {loading && (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#ea580c" />
          <Text style={styles.loaderText}>Loading FMCG Dist...</Text>
        </View>
      )}
      
      <WebView
        source={{ uri: 'https://willowy-sawine-450377.netlify.app' }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        onLoadEnd={() => setLoading(false)}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        automaticallyAdjustContentInsets={true}
        scrollEnabled={true}
        bounces={true}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  webview: {
    flex: 1,
  },
  loaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    zIndex: 10,
  },
  loaderText: {
    color: '#f1f5f9',
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
  },
});