import { PrismaClient, ParticipantRole } from "@prisma/client";
import { randomBytes } from "node:crypto";

const prisma = new PrismaClient();

async function main() {
  const room = await prisma.room.upsert({
    where: { code: "DEMO2026" },
    update: {},
    create: {
      code: "DEMO2026",
      name: "Demo Sprint Planning"
    }
  });

  const moderator = await prisma.participant.upsert({
    where: { sessionToken: "demo-moderator-token" },
    update: {},
    create: {
      roomId: room.id,
      displayName: "Moderador Demo",
      sessionToken: "demo-moderator-token",
      role: ParticipantRole.MODERATOR
    }
  });

  await prisma.room.update({
    where: { id: room.id },
    data: { moderatorParticipantId: moderator.id }
  });

  const count = await prisma.story.count({ where: { roomId: room.id } });
  if (count === 0) {
    await prisma.story.createMany({
      data: [
        { roomId: room.id, title: "Configurar autenticacion futura", position: 1 },
        { roomId: room.id, title: "Invitar participantes por enlace", position: 2 },
        { roomId: room.id, title: "Exportar historial de estimaciones", position: 3 }
      ]
    });
  }

  console.log(`Seeded demo room ${room.code}. Token hint ${randomBytes(4).toString("hex")}`);
}

main().finally(async () => {
  await prisma.$disconnect();
});
