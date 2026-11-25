import { BrandLogo } from '@/shared/ui/brand-logo';
import { Card } from '@/shared/ui/card';
import { CardContent } from '@/shared/ui/card-content';
import { CardDescription } from '@/shared/ui/card-description';
import { CardHeader } from '@/shared/ui/card-header';
import { CardTitle } from '@/shared/ui/card-title';

export interface SessionLoadingScreenProps {
  subtitle: string;
  title: string;
  description: string;
}

export function SessionLoadingScreen({
  subtitle,
  title,
  description,
}: SessionLoadingScreenProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader className="items-center text-center">
          <BrandLogo subtitle={subtitle} />
          <CardTitle className="pt-2 text-xl font-semibold tracking-tight">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-sm text-muted-foreground">Checking session...</p>
        </CardContent>
      </Card>
    </div>
  );
}
