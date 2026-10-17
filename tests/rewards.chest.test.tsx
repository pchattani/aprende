import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChestReveal } from '@/components/rewards/ChestReveal'
import { LevelUp } from '@/components/rewards/LevelUp'
import { coinsLabel } from '@/engine/economy'
import { WARDROBE } from '@/engine/journey'

describe('ChestReveal', () => {
  it('stays shut until tapped, then shows the souvenir and calls onOpen once', () => {
    const item = WARDROBE[0]!
    let opened = 0
    render(<ChestReveal reward={{ kind: 'souvenir', souvenir: item }} label="Lucky find" onOpen={() => opened++} dog={null} />)
    expect(screen.queryByText(item.blurb, { exact: false })).toBeNull()
    const chest = screen.getByRole('button', { name: 'Open the lucky find chest' })
    fireEvent.click(chest)
    fireEvent.click(chest)
    expect(opened).toBe(1)
    expect(screen.getByText(item.es)).toBeInTheDocument()
    expect(screen.getByText(/Added to your passport/)).toBeInTheDocument()
  })
  it('reveals a purse of coins', () => {
    render(<ChestReveal reward={{ kind: 'coins', amount: 40 }} label="Errand reward" dog={null} />)
    fireEvent.click(screen.getByRole('button', { name: /Open the errand reward chest/ }))
    expect(screen.getByText(`+${coinsLabel(40)}`)).toBeInTheDocument()
  })
})

describe('LevelUp', () => {
  it('announces the level, the new title and closes from its button', () => {
    let closed = false
    render(<LevelUp level={3} newTitle="Backpacker" coins={30} onClose={() => (closed = true)} />)
    expect(screen.getByRole('dialog', { name: 'Level 3!' })).toBeInTheDocument()
    expect(screen.getByText('New title')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Keep travelling' }))
    expect(closed).toBe(true)
  })
})
