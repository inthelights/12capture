'use client'

import { useState, useRef } from 'react'
import { Camera, Upload, Copy, Shield, AlertTriangle, QrCode, FileImage } from 'lucide-react'
import Tesseract from 'tesseract.js'
import QRCode from 'qrcode'

export default function Home() {
  const [image, setImage] = useState<string | null>(null)
  const [extractedText, setExtractedText] = useState<string>('')
  const [seedPhrase, setSeedPhrase] = useState<string>('')
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string>('')
  const [copySuccess, setCopySuccess] = useState(false)
  const [activeTab, setActiveTab] = useState<'text' | 'qr'>('text')
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)

  const extractSeedPhrase = (text: string): string => {
    // Look for numbered seed phrases - handle multiple formats
    const matches: { number: number; word: string }[] = []
    
    // Try different patterns to find numbered words
    const patterns = [
      // Pattern 1: "1 word 2 word" (space separated, most common)
      /(\d+)\s+([a-z]+)/gi,
      // Pattern 2: "1. word 2. word" (dot separated)
      /(\d+)\.\s*([a-z]+)/gi,
      // Pattern 3: "1) word 2) word" (parenthesis separated)
      /(\d+)\)\s*([a-z]+)/gi
    ]
    
    for (const pattern of patterns) {
      let match
      pattern.lastIndex = 0 // Reset regex state
      
      while ((match = pattern.exec(text)) !== null) {
        const number = parseInt(match[1])
        const word = match[2].trim().toLowerCase()
        
        // Only collect words numbered 1-12 and ensure it's a valid word
        if (number >= 1 && number <= 12 && word.length > 0 && /^[a-z]+$/.test(word)) {
          // Avoid duplicates by checking if this number already exists
          const existingIndex = matches.findIndex(m => m.number === number)
          if (existingIndex === -1) {
            matches.push({ number, word })
          }
        }
      }
      
      // If we found enough matches with this pattern, use it
      if (matches.length >= 12) {
        break
      }
    }
    
    // Sort by number and extract words
    if (matches.length >= 12) {
      const sortedMatches = matches
        .sort((a, b) => a.number - b.number)
        .slice(0, 12) // Take only first 12
      
      // Check if we have a good sequence (at least 10 out of 12 numbers)
      const hasGoodSequence = sortedMatches.length >= 10
      
      if (hasGoodSequence) {
        return sortedMatches.map(item => item.word).join(' ')
      }
    }
    
    // Fallback: look for any 12 consecutive words if numbered pattern fails
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .split(/\s+/)
      .filter(word => word.length > 0 && /^[a-z]+$/.test(word)) // Only alphabetic words
    
    if (words.length >= 12) {
      return words.slice(0, 12).join(' ')
    }
    
    return ''
  }

  const generateQRCode = async (text: string) => {
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(text, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })
      setQrCodeDataUrl(qrCodeDataUrl)
    } catch (err) {
      console.error('QR Code generation error:', err)
    }
  }

  const processImage = async (imageData: string) => {
    setIsProcessing(true)
    setError('')
    
    try {
      const { data: { text } } = await Tesseract.recognize(imageData, 'eng', {
        logger: m => console.log(m)
      })
      
      setExtractedText(text)
      const phrase = extractSeedPhrase(text.toLowerCase())
      setSeedPhrase(phrase)
      
      if (phrase) {
        // Generate QR code for the seed phrase
        await generateQRCode(phrase)
      } else {
        setError('No 12-word seed phrase detected. Please ensure the image contains a numbered seed phrase (1. word 2. word ... 12. word) and the text is clear and readable.')
      }
    } catch (err) {
      setError('Failed to process image. Please try again.')
      console.error('OCR Error:', err)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        setImage(result)
        processImage(result)
      }
      reader.readAsDataURL(file)
    }
  }

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      })
      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
    } catch (err) {
      setError('Camera access denied. Please allow camera permission and try again.')
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
  }

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current
      const video = videoRef.current
      const context = canvas.getContext('2d')
      
      if (context) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        context.drawImage(video, 0, 0)
        
        const imageData = canvas.toDataURL('image/jpeg')
        setImage(imageData)
        stopCamera()
        processImage(imageData)
      }
    }
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(seedPhrase)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (err) {
      setError('Failed to copy to clipboard')
    }
  }

  const resetApp = () => {
    setImage(null)
    setExtractedText('')
    setSeedPhrase('')
    setQrCodeDataUrl('')
    setError('')
    setCopySuccess(false)
    setActiveTab('text')
    stopCamera()
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-gray-200/60 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-sm sm:text-base">12</span>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">12Capture</h1>
                <p className="text-sm sm:text-base text-gray-600 mt-0.5">Secure seed phrase extraction</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-600 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full">
              <Shield className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />
              <span className="hidden sm:inline font-medium">100% Client-side</span>
              <span className="sm:hidden font-medium">Secure</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Security Notice */}
        <div className="mb-6 sm:mb-8 p-4 sm:p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/50 rounded-xl shadow-sm">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <Shield className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 text-sm sm:text-base">Privacy & Security</h3>
              <p className="text-blue-800 text-xs sm:text-sm mt-1 leading-relaxed">
                Your images are processed entirely in your browser. Nothing is saved, transmitted, or stored anywhere. 
                Refresh the page to clear all data.
              </p>
            </div>
          </div>
        </div>

        {/* Upload Section */}
        {!image && (
          <div className="max-w-sm sm:max-w-md mx-auto mb-6 sm:mb-8">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200/50 p-6 sm:p-8">
              <div className="text-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6">
                  <FileImage className="w-8 h-8 sm:w-10 sm:h-10 text-indigo-600" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">Extract Seed Phrase</h3>
                <p className="text-sm sm:text-base text-gray-600 mb-6 sm:mb-8 leading-relaxed">
                  Upload an image or take a photo of your numbered seed phrase
                </p>
                
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  {/* Upload Button */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="group flex flex-col items-center p-4 sm:p-5 border-2 border-dashed border-gray-300 rounded-xl hover:border-indigo-400 hover:bg-indigo-50/50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    disabled={isProcessing}
                  >
                    <Upload className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400 group-hover:text-indigo-600 mb-2 transition-colors" />
                    <span className="text-xs sm:text-sm font-medium text-gray-700 group-hover:text-indigo-700">Upload</span>
                  </button>
                  
                  {/* Camera Button */}
                  <button
                    onClick={startCamera}
                    className="group flex flex-col items-center p-4 sm:p-5 border-2 border-dashed border-gray-300 rounded-xl hover:border-indigo-400 hover:bg-indigo-50/50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    disabled={isProcessing}
                  >
                    <Camera className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400 group-hover:text-indigo-600 mb-2 transition-colors" />
                    <span className="text-xs sm:text-sm font-medium text-gray-700 group-hover:text-indigo-700">Camera</span>
                  </button>
                </div>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </div>
          </div>
        )}

        {/* Camera View */}
        {stream && (
          <div className="max-w-sm sm:max-w-md mx-auto mb-6 sm:mb-8">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200/50 p-4 sm:p-6">
              <div className="text-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-48 sm:h-64 object-cover rounded-xl mb-4 sm:mb-6"
                />
                <canvas ref={canvasRef} className="hidden" />
                <div className="flex space-x-3">
                  <button
                    onClick={capturePhoto}
                    className="btn-primary flex-1 text-sm sm:text-base py-2.5 sm:py-3"
                  >
                    Capture Photo
                  </button>
                  <button
                    onClick={stopCamera}
                    className="btn-secondary flex-1 text-sm sm:text-base py-2.5 sm:py-3"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Processing Status */}
        {isProcessing && (
          <div className="max-w-sm sm:max-w-md mx-auto mb-6 sm:mb-8">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200/50 p-6 sm:p-8">
              <div className="text-center">
                <div className="animate-spin w-8 h-8 sm:w-10 sm:h-10 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-sm sm:text-base text-gray-600 font-medium">Processing image and extracting text...</p>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="max-w-sm sm:max-w-md mx-auto mb-6 sm:mb-8">
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 sm:p-6">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                </div>
                <p className="text-sm sm:text-base text-red-800 leading-relaxed">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {seedPhrase && (
          <div className="max-w-sm sm:max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200/50 overflow-hidden">
              {/* Tab Navigation */}
              <div className="flex border-b border-gray-200">
                <button
                  onClick={() => setActiveTab('text')}
                  className={`flex-1 py-3 sm:py-4 px-4 text-sm sm:text-base font-medium text-center border-b-2 transition-all duration-200 ${
                    activeTab === 'text'
                      ? 'border-indigo-500 text-indigo-600 bg-indigo-50/50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Text
                </button>
                <button
                  onClick={() => setActiveTab('qr')}
                  className={`flex-1 py-3 sm:py-4 px-4 text-sm sm:text-base font-medium text-center border-b-2 transition-all duration-200 ${
                    activeTab === 'qr'
                      ? 'border-indigo-500 text-indigo-600 bg-indigo-50/50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  QR Code
                </button>
              </div>

              {/* Tab Content */}
              <div className="p-4 sm:p-6">
                {activeTab === 'text' && (
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Extracted Seed Phrase</h3>
                    <div className="bg-gray-50 rounded-xl p-3 sm:p-4 mb-4 sm:mb-6">
                      <p className="text-gray-800 font-mono text-xs sm:text-sm leading-relaxed break-words">
                        {seedPhrase}
                      </p>
                    </div>
                    <button
                      onClick={copyToClipboard}
                      className={`w-full py-2.5 sm:py-3 px-4 rounded-xl font-medium text-sm sm:text-base transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                        copySuccess 
                          ? 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-500' 
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white focus:ring-indigo-500'
                      }`}
                    >
                      <Copy className="w-4 h-4 inline mr-2" />
                      {copySuccess ? 'Copied!' : 'Copy to Clipboard'}
                    </button>
                  </div>
                )}

                {activeTab === 'qr' && qrCodeDataUrl && (
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">QR Code</h3>
                    <div className="text-center">
                      <div className="inline-block p-3 sm:p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                        <img
                          src={qrCodeDataUrl}
                          alt="Seed Phrase QR Code"
                          className="w-48 h-48 sm:w-64 sm:h-64 mx-auto"
                        />
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600 mt-3 sm:mt-4 leading-relaxed">
                        Scan this QR code with another device to import the seed phrase
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Raw Extracted Text (for debugging) */}
        {extractedText && (
          <div className="max-w-sm sm:max-w-2xl mx-auto mt-4 sm:mt-6">
            <details className="bg-white rounded-2xl shadow-lg border border-gray-200/50 overflow-hidden">
              <summary className="cursor-pointer text-xs sm:text-sm font-medium text-gray-700 hover:text-gray-900 p-4 sm:p-6 border-b border-gray-100">
                View Raw Extracted Text
              </summary>
              <div className="p-4 sm:p-6 bg-gray-50">
                <pre className="text-xs text-gray-600 whitespace-pre-wrap break-words leading-relaxed">
                  {extractedText}
                </pre>
              </div>
            </details>
          </div>
        )}

        {/* Action Button */}
        {seedPhrase && (
          <div className="max-w-sm sm:max-w-2xl mx-auto mt-4 sm:mt-6">
            <div className="text-center">
              <button
                onClick={resetApp}
                className="w-full sm:w-auto py-2.5 sm:py-3 px-6 sm:px-8 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm sm:text-base rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Process Another Image
              </button>
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="bg-white/90 backdrop-blur-md border-t border-gray-200/60 mt-12 sm:mt-16 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center space-x-2 text-xs sm:text-sm text-gray-600">
              <div className="w-6 h-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xs">12</span>
              </div>
              <span className="font-semibold">12Capture</span>
              <span className="text-gray-400">•</span>
              <span>Secure seed phrase extraction tool</span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 max-w-2xl mx-auto leading-relaxed">
              No data is saved or transmitted. Everything is processed locally in your browser.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}