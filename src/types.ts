export type ServiceStyle = 'class' | 'factory' | 'plain';

export interface AdditionalImportSpec {
  from: string;
  names?: string[];
  default?: string;
  namespace?: string;
}

export interface ServicesConfig {
  withServices: boolean;
  serviceStyle: ServiceStyle;
  serviceDir: string;
  withListMethod: boolean;
  serviceImports: AdditionalImportSpec[];
}
