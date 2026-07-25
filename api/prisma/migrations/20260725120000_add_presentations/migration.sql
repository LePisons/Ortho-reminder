-- CreateTable
CREATE TABLE "Presentation" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slides" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "patientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Presentation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlideTemplate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slide" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "SlideTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresentationAsset" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "presentationId" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "PresentationAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Presentation_patientId_idx" ON "Presentation"("patientId");

-- CreateIndex
CREATE INDEX "Presentation_userId_idx" ON "Presentation"("userId");

-- CreateIndex
CREATE INDEX "SlideTemplate_userId_idx" ON "SlideTemplate"("userId");

-- CreateIndex
CREATE INDEX "PresentationAsset_presentationId_idx" ON "PresentationAsset"("presentationId");

-- CreateIndex
CREATE INDEX "PresentationAsset_userId_idx" ON "PresentationAsset"("userId");

-- AddForeignKey
ALTER TABLE "Presentation" ADD CONSTRAINT "Presentation_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Presentation" ADD CONSTRAINT "Presentation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlideTemplate" ADD CONSTRAINT "SlideTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresentationAsset" ADD CONSTRAINT "PresentationAsset_presentationId_fkey" FOREIGN KEY ("presentationId") REFERENCES "Presentation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresentationAsset" ADD CONSTRAINT "PresentationAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
