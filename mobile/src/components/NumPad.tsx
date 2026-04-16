import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Vibration } from 'react-native'

interface NumPadProps {
  value: string
  onChange: (value: string) => void
  maxLength?: number
  variant?: 'default' | 'transparent'
}

const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', '⌫'],
]

export default function NumPad({ value, onChange, maxLength = 4, variant = 'default' }: NumPadProps) {
  function handleKey(key: string) {
    if (key === '⌫') {
      onChange(value.slice(0, -1))
    } else if (key === '') {
      return
    } else if (value.length < maxLength) {
      Vibration.vibrate(30)
      onChange(value + key)
    }
  }

  const isTransparent = variant === 'transparent'

  return (
    <View style={styles.container}>
      {KEYS.map((row, ri) => (
        <View key={ri} style={styles.row}>
          {row.map((key, ki) => (
            <TouchableOpacity
              key={ki}
              style={[
                styles.key, 
                key === '' && styles.keyEmpty,
                isTransparent && styles.keyTransparent,
                (isTransparent && key === '') && styles.keyEmptyTransparent
              ]}
              onPress={() => handleKey(key)}
              disabled={key === ''}
              activeOpacity={0.6}
            >
              <Text style={[
                styles.keyText, 
                key === '⌫' && styles.keyDelete,
                isTransparent && styles.keyTextTransparent
              ]}>
                {key}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  row: { flexDirection: 'row', justifyContent: 'center', marginBottom: 12 },
  key: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1C3D1A',
    marginHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyTransparent: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  keyEmpty: { backgroundColor: 'transparent' },
  keyEmptyTransparent: { backgroundColor: 'transparent', borderWidth: 0 },
  keyText: { fontSize: 26, fontWeight: '600', color: '#FFFFFF' },
  keyTextTransparent: { color: '#FFFFFF' },
  keyDelete: { fontSize: 22 },
})
