import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { registerSW } from './registerSW.js'

registerSW()

createRoot(document.getElementById('root')).render(<App />)
