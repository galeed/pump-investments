"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { io } from "socket.io-client"
import { db, type StoredTrade } from "@/lib/db"

// Define the Trade type based on the WebSocket data
export interface Trade {
  mint: string
  name: string
  symbol: string
  image_uri: string
  usd_market_cap: number
  market_cap: number
  sol_amount: number // Raw lamports amount
  is_buy: boolean
  user: string
  creator: string
  creator_username: string
  token_amount: number
  total_supply: number
  timestamp: number
  received_time?: number
  virtual_sol_reserves: number
  virtual_token_reserves: number
  signature: string
  created_timestamp?: number
  website?: string | null
  twitter?: string | null
  telegram?: string | null
  king_of_the_hill_timestamp?: number | null
  description?: string | null
  [key: string]: any
}

export function useWebSocketTrades(setAllTrades: React.Dispatch<React.SetStateAction<Trade[]>>) {
  const [isConnected, setIsConnected] = useState<boolean>(false)
  console.log("[WebSocketTrades] Initial isConnected state:", isConnected) // This will always be false initially
  const socketRef = useRef<any>(null)

  // Connect to WebSocket - always stay connected regardless of pause state
  useEffect(() => {
    console.log("[WebSocketTrades] useEffect triggered to set up WebSocket.")

    const handleTradeCreated = async (newTrade: Trade) => {
      newTrade.received_time = Date.now()
      try {
        const storedTrade: StoredTrade = {
          ...newTrade,
          id: `${newTrade.mint}-${newTrade.timestamp}-${newTrade.signature}`,
          received_time: newTrade.received_time,
        }
        await db.addTrade(storedTrade)
      } catch (error) {
        console.error("Error storing trade:", error)
      }

      setAllTrades((prevTrades) => {
        const oneHourAgo = Date.now() - 60 * 60 * 1000
        const filteredTrades = prevTrades.filter(
          (trade) => (trade.received_time || trade.timestamp * 1000) >= oneHourAgo,
        )
        return [...filteredTrades, newTrade]
      })

      if (socketRef.current && socketRef.current.connected) {
        setIsConnected((currentIsConnected) => {
          if (!currentIsConnected) {
            console.log("[WebSocketTrades] handleTradeCreated: Correcting isConnected state to true.")
            return true
          }
          return currentIsConnected
        })
      }
    }

    // Disconnect previous socket instance if effect re-runs (though it shouldn't with stable setAllTrades)
    if (socketRef.current) {
      console.log("[WebSocketTrades] Disconnecting previous socket instance.")
      socketRef.current.disconnect()
    }

    const socket = io("wss://frontend-api-v3.pump.fun", {
      transports: ["websocket"],
      upgrade: false,
      reconnection: true,
      reconnectionAttempts: Number.POSITIVE_INFINITY,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
    })
    socketRef.current = socket

    // Set initial state based on socket.connected AFTER instance creation
    // but rely on 'connect' event for the definitive true state.
    setIsConnected(socket.connected)
    console.log(
      "[WebSocketTrades] New socket instance created. Initial socket.connected:",
      socket.connected,
      "Current isConnected state:",
      socket.connected,
    )

    const onConnect = () => {
      console.log("[WebSocketTrades] WebSocket event: 'connect'. Setting isConnected to true.")
      setIsConnected(true)
    }

    const onDisconnect = (reason: string) => {
      console.log("[WebSocketTrades] WebSocket event: 'disconnect'. Reason:", reason, ". Setting isConnected to false.")
      setIsConnected(false)
    }

    const onConnectError = (error: Error) => {
      console.error("[WebSocketTrades] WebSocket event: 'connect_error'. Error:", error)
      setIsConnected(false)
    }

    socket.on("connect", onConnect)
    socket.on("tradeCreated", handleTradeCreated)
    socket.on("disconnect", onDisconnect)
    socket.on("connect_error", onConnectError)

    return () => {
      console.log("[WebSocketTrades] Cleanup: Disconnecting socket and removing listeners.")
      socket.off("connect", onConnect)
      socket.off("tradeCreated", handleTradeCreated)
      socket.off("disconnect", onDisconnect)
      socket.off("connect_error", onConnectError)
      socket.disconnect()
      socketRef.current = null
      setIsConnected(false) // Ensure state is false on cleanup
    }
  }, [setAllTrades]) // setAllTrades is stable, so this effect runs effectively once on mount.

  return { isConnected }
}
