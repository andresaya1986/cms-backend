import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Admin user
  const adminHash = await bcrypt.hash('Admin1234!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      username: 'admin',
      displayName: 'Administrador',
      passwordHash: adminHash,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      emailVerified: true,
    },
  });

  // Demo author
  const authorHash = await bcrypt.hash('Author1234!', 12);
  const author = await prisma.user.upsert({
    where: { email: 'author@example.com' },
    update: {},
    create: {
      email: 'author@example.com',
      username: 'demo_author',
      displayName: 'Demo Author',
      bio: 'Escritor de contenido de ejemplo',
      passwordHash: authorHash,
      role: 'AUTHOR',
      status: 'ACTIVE',
      emailVerified: true,
    },
  });

  // Categorías
  const categories = await Promise.all([
    prisma.category.upsert({ where: { slug: 'tecnologia' }, update: {}, create: { name: 'Tecnología', slug: 'tecnologia', description: 'Posts sobre tech' } }),
    prisma.category.upsert({ where: { slug: 'tutorials' }, update: {}, create: { name: 'Tutoriales', slug: 'tutorials', description: 'Aprende haciendo' } }),
    prisma.category.upsert({ where: { slug: 'noticias' }, update: {}, create: { name: 'Noticias', slug: 'noticias', description: 'Últimas noticias' } }),
  ]);

  // Tags
  const tags = await Promise.all([
    prisma.tag.upsert({ where: { slug: 'nodejs' }, update: {}, create: { name: 'Node.js', slug: 'nodejs' } }),
    prisma.tag.upsert({ where: { slug: 'docker' }, update: {}, create: { name: 'Docker', slug: 'docker' } }),
    prisma.tag.upsert({ where: { slug: 'typescript' }, update: {}, create: { name: 'TypeScript', slug: 'typescript' } }),
    prisma.tag.upsert({ where: { slug: 'postgresql' }, update: {}, create: { name: 'PostgreSQL', slug: 'postgresql' } }),
  ]);

  // Post de ejemplo
  await prisma.post.upsert({
    where: { slug: 'bienvenido-al-cms' },
    update: {},
    create: {
      authorId: author.id,
      title: 'Bienvenido al CMS',
      slug: 'bienvenido-al-cms',
      excerpt: 'Este es el primer post del CMS. Aquí encontrarás todo lo que necesitas.',
      content: '# Bienvenido\n\nEste es el primer post de ejemplo del CMS. El sistema está listo para usar.',
      status: 'PUBLISHED',
      type: 'ARTICLE',
      visibility: 'PUBLIC',
      publishedAt: new Date(),
      metaTitle: 'Bienvenido al CMS',
      metaDescription: 'Primer post de ejemplo del CMS monolito modular con Node.js',
      categories: { create: [{ categoryId: categories[0].id }] },
      tags: { create: [{ tagId: tags[0].id }, { tagId: tags[1].id }] },
    },
  });

  console.log(`✅ Admin: admin@example.com / Admin1234!`);
  console.log(`✅ Author: author@example.com / Author1234!`);
  console.log(`✅ ${categories.length} categorías, ${tags.length} tags`);
  console.log('🎉 Seed completado');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
