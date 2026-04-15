import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Vibration } from 'react-native'

interface NumPadProps {
  value: string
  onChange: (value: string) => void
  maxLength?: number
}

const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', '⌫'],
]

export default function NumPad({ value, onChange, maxLength = 4 }: NumPadProps) {
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

  return (
    <View style={styles.container}>
      {KEYS.map((row, ri) => (
        <View key={ri} style={styles.row}>
          {row.map((key, ki) => (
            <TouchableOpacity
              key={ki}
              style={[styles.key, key === '' && styles.keyEmpty]}
              onPress={() => handleKey(key)}
              disabled={key === ''}
              activeOpacity={0.6}
            >
              <Text style={[styles.keyText, key === '⌫' && styles.keyDelete]}>
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
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#1C3D1A',
    marginHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyEmpty: { backgroundColor: 'transparent' },
  keyText: { fontSize: 28, fontWeight: '600', color: '#FFFFFF' },
  keyDelete: { fontSize: 22 },
})
