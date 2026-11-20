import * as yaml from 'js-yaml';
import siteYamlRaw from './site.yaml?raw';

export type SchemaTableKey = 'users' | 'funnel' | 'transactions' | 'transaction_items' | 'catalog';

export interface SchemaColumnSpec {
  name: string;
  type: string;
  note: string;
}

export interface SchemaTableSpec {
  filename: string;
  grain: string;
  description: string;
  columns: SchemaColumnSpec[];
}

export interface LeverGlossaryItem {
  key: string;
  label: string;
  yamlPath: string;
  summary: string;
  mechanism: string;
  outputImpact: string;
}

export interface PipelineStepSpec {
  step: string;
  title: string;
  detail: string;
}

export interface TraceOrderStepSpec {
  step: string;
  title: string;
  code: string;
  detail: string;
}

export interface SiteContent {
  brand: {
    name: string;
    domain: string;
    parentDomain: string;
    footerLabel: string;
    zeroComputeLabel: string;
  };
  nav: {
    studio: string;
    dashboard: string;
    yaml: string;
    about: string;
  };
  about: {
    pipelineTitle: string;
    pipelineSubtitle: string;
    pipelineSteps: PipelineStepSpec[];
    schemaTitle: string;
    schemaSubtitle: string;
    schemaTables: Record<SchemaTableKey, SchemaTableSpec>;
    glossaryTitle: string;
    glossarySubtitle: string;
    simulationLevers: LeverGlossaryItem[];
    traceTitle: string;
    traceSubtitle: string;
    traceOrderSteps: TraceOrderStepSpec[];
  };
}

export const SITE_CONTENT = yaml.load(siteYamlRaw) as SiteContent;
