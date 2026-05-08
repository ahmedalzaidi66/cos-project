import { useEffect } from 'react';
import { useRouter, Stack } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

export default function NotFoundScreen() {
  const router = useRouter();

  useEffect(() => {
    // Redirect unknown routes to home immediately
    router.replace('/');
  }, []);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <ActivityIndicator color="#FF4D8D" size="large" />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0507',
  },
});
