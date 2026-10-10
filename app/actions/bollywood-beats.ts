'use server'
import prisma from '@/lib/db'

export async function getAllBollywoodSongs() {
  return prisma.bollywoodSong.findMany()
}
