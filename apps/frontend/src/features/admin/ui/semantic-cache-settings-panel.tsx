import {
  SEMANTIC_CACHE_VALIDATION_LIMITS,
  type SemanticCacheSettingsResponseDto,
} from '@semcache/shared-dtos';
import { CacheMode, QueryCategory } from '@semcache/shared-types';
import { Loader2, RotateCcw, Save, SlidersHorizontal } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  CACHE_MODE_DESCRIPTIONS,
  CACHE_MODE_LABELS,
  CACHE_MODE_SHORT_LABELS,
  type CacheSettingsFormValues,
  getDefaultCacheSettingsFormValues,
  validateCacheSettingsForm,
} from '@/features/admin/model/admin-helpers';
import { useUpdateSemanticCacheSettingsMutation } from '@/features/admin/model/use-admin';
import { CATEGORY_LABELS } from '@/features/knowledge-base/model/knowledge-base-helpers';
import { getAuthServerError } from '@/shared/api/api-client';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { CardContent } from '@/shared/ui/card-content';
import { CardDescription } from '@/shared/ui/card-description';
import { CardHeader } from '@/shared/ui/card-header';
import { CardTitle } from '@/shared/ui/card-title';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Separator } from '@/shared/ui/separator';

export interface SemanticCacheSettingsPanelProps {
  settings?: SemanticCacheSettingsResponseDto;
  isPending: boolean;
}

export function SemanticCacheSettingsPanel({
  settings,
  isPending,
}: SemanticCacheSettingsPanelProps) {
  const updateMutation = useUpdateSemanticCacheSettingsMutation();
  const [form, setForm] = useState<CacheSettingsFormValues>(getDefaultCacheSettingsFormValues);

  useEffect(() => {
    if (settings) {
      setForm({
        fixedThreshold: settings.fixedThreshold,
        adaptiveBaseThreshold: settings.adaptiveBaseThreshold,
        minAdaptiveThreshold: settings.minAdaptiveThreshold,
        maxAdaptiveThreshold: settings.maxAdaptiveThreshold,
        densityWeight: settings.densityWeight,
        densityKNeighbors: settings.densityKNeighbors,
        categoryWeights: { ...settings.categoryWeights },
      });
    }
  }, [settings]);

  const handleModeSwitch = async (mode: CacheMode) => {
    if (!settings || settings.mode === mode) {
      return;
    }
    try {
      const updated = await updateMutation.mutateAsync({ mode });
      toast.success(`Switched cache mode to ${CACHE_MODE_LABELS[updated.mode]}.`);
    } catch (error) {
      toast.error(getAuthServerError(error as Error, 'Failed to switch semantic cache mode.'));
    }
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    const validationError = validateCacheSettingsForm(form);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      await updateMutation.mutateAsync({
        fixedThreshold: form.fixedThreshold,
        adaptiveBaseThreshold: form.adaptiveBaseThreshold,
        minAdaptiveThreshold: form.minAdaptiveThreshold,
        maxAdaptiveThreshold: form.maxAdaptiveThreshold,
        densityWeight: form.densityWeight,
        densityKNeighbors: form.densityKNeighbors,
        categoryWeights: form.categoryWeights,
      });
      toast.success('Semantic cache threshold parameters updated.');
    } catch (error) {
      toast.error(getAuthServerError(error as Error, 'Failed to update semantic cache settings.'));
    }
  };

  const handleResetDefaults = () => {
    setForm(getDefaultCacheSettingsFormValues());
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <SlidersHorizontal className="size-4 text-primary" />
            Semantic Cache Regime &amp; Thresholds
          </CardTitle>
          {settings ? <Badge variant="teal">{CACHE_MODE_LABELS[settings.mode]}</Badge> : null}
        </div>
        <CardDescription>
          Switch between caching modes and tune fixed, density, and per-category adaptive
          thresholds.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {isPending || !settings ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading cache settings...
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Active Cache Mode</Label>
              <div className="grid gap-2 sm:grid-cols-3" role="group" aria-label="Cache Mode">
                {Object.values(CacheMode).map((mode) => {
                  const active = settings.mode === mode;
                  return (
                    <Button
                      key={mode}
                      type="button"
                      variant={active ? 'default' : 'outline'}
                      aria-pressed={active}
                      disabled={updateMutation.isPending}
                      onClick={() => void handleModeSwitch(mode)}
                      className="justify-center"
                    >
                      {CACHE_MODE_SHORT_LABELS[mode]}
                    </Button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {CACHE_MODE_DESCRIPTIONS[settings.mode]}
              </p>
            </div>

            <Separator />

            <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="cache-fixed-threshold" className="text-xs">
                    Fixed Threshold
                  </Label>
                  <Input
                    id="cache-fixed-threshold"
                    type="number"
                    step="0.01"
                    min={SEMANTIC_CACHE_VALIDATION_LIMITS.MIN_THRESHOLD}
                    max={SEMANTIC_CACHE_VALIDATION_LIMITS.MAX_THRESHOLD}
                    value={form.fixedThreshold}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, fixedThreshold: Number(e.target.value) }))
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cache-adaptive-base" className="text-xs">
                    Adaptive Base Threshold
                  </Label>
                  <Input
                    id="cache-adaptive-base"
                    type="number"
                    step="0.01"
                    min={SEMANTIC_CACHE_VALIDATION_LIMITS.MIN_THRESHOLD}
                    max={SEMANTIC_CACHE_VALIDATION_LIMITS.MAX_THRESHOLD}
                    value={form.adaptiveBaseThreshold}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        adaptiveBaseThreshold: Number(e.target.value),
                      }))
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cache-min-adaptive" className="text-xs">
                    Min Adaptive Threshold
                  </Label>
                  <Input
                    id="cache-min-adaptive"
                    type="number"
                    step="0.01"
                    min={SEMANTIC_CACHE_VALIDATION_LIMITS.MIN_THRESHOLD}
                    max={SEMANTIC_CACHE_VALIDATION_LIMITS.MAX_THRESHOLD}
                    value={form.minAdaptiveThreshold}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        minAdaptiveThreshold: Number(e.target.value),
                      }))
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cache-max-adaptive" className="text-xs">
                    Max Adaptive Threshold
                  </Label>
                  <Input
                    id="cache-max-adaptive"
                    type="number"
                    step="0.01"
                    min={SEMANTIC_CACHE_VALIDATION_LIMITS.MIN_THRESHOLD}
                    max={SEMANTIC_CACHE_VALIDATION_LIMITS.MAX_THRESHOLD}
                    value={form.maxAdaptiveThreshold}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        maxAdaptiveThreshold: Number(e.target.value),
                      }))
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cache-density-weight" className="text-xs">
                    Density Weight (alpha)
                  </Label>
                  <Input
                    id="cache-density-weight"
                    type="number"
                    step="0.01"
                    min={SEMANTIC_CACHE_VALIDATION_LIMITS.MIN_DENSITY_WEIGHT}
                    max={SEMANTIC_CACHE_VALIDATION_LIMITS.MAX_DENSITY_WEIGHT}
                    value={form.densityWeight}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, densityWeight: Number(e.target.value) }))
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cache-density-k" className="text-xs">
                    Density K Neighbors
                  </Label>
                  <Input
                    id="cache-density-k"
                    type="number"
                    step="1"
                    min={SEMANTIC_CACHE_VALIDATION_LIMITS.MIN_DENSITY_K_NEIGHBORS}
                    max={SEMANTIC_CACHE_VALIDATION_LIMITS.MAX_DENSITY_K_NEIGHBORS}
                    value={form.densityKNeighbors}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, densityKNeighbors: Number(e.target.value) }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Category Threshold Offsets</Label>
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.values(QueryCategory).map((category) => (
                    <div key={category} className="space-y-1">
                      <Label htmlFor={`cache-weight-${category}`} className="text-[11px]">
                        {CATEGORY_LABELS[category]}
                      </Label>
                      <Input
                        id={`cache-weight-${category}`}
                        type="number"
                        step="0.01"
                        min={SEMANTIC_CACHE_VALIDATION_LIMITS.MIN_CATEGORY_WEIGHT}
                        max={SEMANTIC_CACHE_VALIDATION_LIMITS.MAX_CATEGORY_WEIGHT}
                        value={form.categoryWeights[category]}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            categoryWeights: {
                              ...prev.categoryWeights,
                              [category]: Number(e.target.value),
                            },
                          }))
                        }
                        className="h-8 text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResetDefaults}
                  disabled={updateMutation.isPending}
                >
                  <RotateCcw className="size-3.5" />
                  Reset Defaults
                </Button>
                <Button type="submit" size="sm" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="size-3.5" />
                      Save Parameters
                    </>
                  )}
                </Button>
              </div>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  );
}
