import React, { useState } from 'react';
import axios from 'axios';
import { Form, Input, Button, Select, DatePicker, TimePicker, Upload, message, Steps, Card, Modal } from 'antd';
import { InboxOutlined, CheckCircleOutlined, FileTextOutlined } from '@ant-design/icons';
import moment from 'moment';

const { Option } = Select;
const { Dragger } = Upload;
const { Step } = Steps;

/**
 * COMPONENTE COMPLETO: Criação de Tratativa + Geração Automática de PDF
 * 
 * FLUXO CORRETO:
 * 1. Frontend envia dados para /create
 * 2. Backend cria a tratativa e retorna ID + status P1
 * 3. Frontend automaticamente chama /pdftasks se for P1
 * 4. Usuário recebe feedback e pode baixar o PDF
 */
const FluxoCompletoTratativa = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [tratativaId, setTratativaId] = useState(null);
  const [documentoUrl, setDocumentoUrl] = useState(null);
  const [ehP1, setEhP1] = useState(false);

  const API_URL = 'https://iblogistica.ddns.net:3000/api/tratativa';

  // Step 1: Criar Tratativa
  const criarTratativa = async (values) => {
    setLoading(true);
    
    try {
      // 🔧 DADOS CORRETOS PARA O BACKEND (baseado em instrucoes_api.txt)
      const dadosCreate = {
        numero_documento: values.numero_documento,
        nome: values.nome_funcionario,
        funcao: values.funcao,
        setor: values.setor,
        cpf: values.cpf,
        
        // Dados da Infração
        descricao_infracao: values.descricao_infracao,
        data_infracao: values.data_infracao.format('YYYY-MM-DD'), // ISO para o backend
        hora_infracao: values.hora_infracao.format('HH:mm'),
        valor_registrado: values.valor_registrado || '0',
        metrica: values.metrica || 'ocorrências',
        valor_limite: values.valor_limite || '0',
        
        // Dados da Penalidade  
        codigo_infracao: values.codigo_infracao,
        tipo_penalidade: values.tipo_penalidade,
        descricao_penalidade: values.descricao_penalidade,
        url_imagem: values.url_imagem,
        lider: values.lider,
        
        // 🎯 CAMPOS CRÍTICOS PARA PDF (que estavam faltando!)
        advertido: values.codigo_infracao?.startsWith('P1') || values.codigo_infracao?.startsWith('P2') ? 'Advertido' : 'Suspenso'
      };

      console.log('📤 Enviando dados para /create:', dadosCreate);

      const response = await axios.post(`${API_URL}/create`, dadosCreate);
      
      if (response.data.status === 'success') {
        const { id, dados_preservados } = response.data;
        setTratativaId(id);
        
        // ✅ Verificar se é P1 para gerar duas folhas
        const isP1 = values.codigo_infracao?.startsWith('P1');
        setEhP1(isP1);
        
        message.success(`Tratativa criada com sucesso! ID: ${id}`);
        console.log('📋 Dados preservados:', dados_preservados);
        
        setCurrentStep(1);
        
        // 🚀 AUTOMATICAMENTE GERAR PDF
        await gerarPDF(id, isP1);
        
      } else {
        message.error(`Erro ao criar tratativa: ${response.data.message}`);
      }
    } catch (error) {
      console.error('❌ Erro ao criar tratativa:', error);
      message.error('Erro de comunicação com o servidor');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Gerar PDF Automaticamente
  const gerarPDF = async (id, isP1) => {
    setLoading(true);
    
    try {
      console.log(`📄 Gerando PDF para tratativa ${id} (P1: ${isP1})`);
      
      // 🎯 USAR /pdftasks para gerar PDF (duas folhas se P1)
      const response = await axios.post(`${API_URL}/pdftasks`, {
        id: id,
        folhaUnica: !isP1  // false para P1 (duas folhas), true para outras
      });
      
      if (response.data.status === 'success') {
        setDocumentoUrl(response.data.url);
        setCurrentStep(2);
        
        const tipoDoc = isP1 ? 'duas folhas' : 'folha única';
        message.success(`PDF gerado com sucesso (${tipoDoc})!`);
        
      } else {
        message.error(`Erro ao gerar PDF: ${response.data.message}`);
      }
      
    } catch (error) {
      console.error('❌ Erro ao gerar PDF:', error);
      message.error('Erro ao gerar documento PDF');
    } finally {
      setLoading(false);
    }
  };

  // Função para baixar o PDF
  const baixarPDF = () => {
    if (documentoUrl) {
      window.open(documentoUrl, '_blank');
    }
  };

  // Resetar formulário
  const resetar = () => {
    form.resetFields();
    setCurrentStep(0);
    setTratativaId(null);
    setDocumentoUrl(null);
    setEhP1(false);
  };

  const steps = [
    {
      title: 'Criar Tratativa',
      content: (
        <Card title="📝 Dados da Tratativa">
          <Form
            form={form}
            layout="vertical"
            onFinish={criarTratativa}
          >
            {/* Dados do Funcionário */}
            <h3>👤 Dados do Funcionário</h3>
            <Form.Item
              name="numero_documento"
              label="Número do Documento"
              rules={[{ required: true, message: 'Campo obrigatório' }]}
            >
              <Input placeholder="Ex: 1234" />
            </Form.Item>

            <Form.Item
              name="nome_funcionario"
              label="Nome do Funcionário"
              rules={[{ required: true, message: 'Campo obrigatório' }]}
            >
              <Input placeholder="Ex: José da Silva Santos" />
            </Form.Item>

            <Form.Item
              name="funcao"
              label="Função"
              rules={[{ required: true, message: 'Campo obrigatório' }]}
            >
              <Input placeholder="Ex: Motorista Carreteiro" />
            </Form.Item>

            <Form.Item
              name="setor"
              label="Setor"
              rules={[{ required: true, message: 'Campo obrigatório' }]}
            >
              <Input placeholder="Ex: Operacional" />
            </Form.Item>

            <Form.Item
              name="cpf"
              label="CPF"
              rules={[{ required: true, message: 'Campo obrigatório' }]}
            >
              <Input placeholder="Ex: 123.456.789-00" />
            </Form.Item>

            <Form.Item
              name="lider"
              label="Líder/Supervisor"
              rules={[{ required: true, message: 'Campo obrigatório' }]}
            >
              <Input placeholder="Ex: Carlos Alberto Pereira" />
            </Form.Item>

            {/* Dados da Infração */}
            <h3>⚠️ Dados da Infração</h3>
            <Form.Item
              name="descricao_infracao"
              label="Descrição da Infração"
              rules={[{ required: true, message: 'Campo obrigatório' }]}
            >
              <Input.TextArea placeholder="Descreva detalhadamente a infração cometida" />
            </Form.Item>

            <Form.Item
              name="data_infracao"
              label="Data da Infração"
              rules={[{ required: true, message: 'Campo obrigatório' }]}
            >
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              name="hora_infracao"
              label="Hora da Infração"
              rules={[{ required: true, message: 'Campo obrigatório' }]}
            >
              <TimePicker format="HH:mm" style={{ width: '100%' }} />
            </Form.Item>

            {/* Dados da Penalidade */}
            <h3>📋 Dados da Penalidade</h3>
            <Form.Item
              name="codigo_infracao"
              label="Código da Infração"
              rules={[{ required: true, message: 'Campo obrigatório' }]}
            >
              <Select placeholder="Selecione o código">
                <Option value="P1-001">P1-001 - Infração Leve</Option>
                <Option value="P2-001">P2-001 - Infração Média</Option>
                <Option value="P3-001">P3-001 - Infração Grave</Option>
                <Option value="P4-001">P4-001 - Infração Gravíssima</Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="tipo_penalidade"
              label="Tipo de Penalidade"
              rules={[{ required: true, message: 'Campo obrigatório' }]}
            >
              <Select placeholder="Selecione o tipo">
                <Option value="P1 - Orientação Verbal">P1 - Orientação Verbal</Option>
                <Option value="P2 - Advertência Escrita">P2 - Advertência Escrita</Option>
                <Option value="P3 - Suspensão 1 dia">P3 - Suspensão 1 dia</Option>
                <Option value="P4 - Suspensão 3 dias">P4 - Suspensão 3 dias</Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="descricao_penalidade"
              label="Descrição da Penalidade"
              rules={[{ required: true, message: 'Campo obrigatório' }]}
            >
              <Input placeholder="Ex: Advertência Escrita" />
            </Form.Item>

            <Form.Item
              name="url_imagem"
              label="URL da Imagem de Evidência"
              rules={[{ required: true, message: 'Campo obrigatório' }]}
            >
              <Input placeholder="https://kjlwqezxzqjfhacmjhbh.supabase.co/storage/v1/object/public/tratativas/..." />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} size="large">
                ✅ Criar Tratativa
              </Button>
            </Form.Item>
          </Form>
        </Card>
      ),
    },
    {
      title: 'Gerar PDF',
      content: (
        <Card title="📄 Geração do PDF">
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <CheckCircleOutlined style={{ fontSize: '48px', color: '#52c41a' }} />
            <h2>Tratativa Criada com Sucesso!</h2>
            <p>ID da Tratativa: <strong>{tratativaId}</strong></p>
            <p>Tipo: <strong>{ehP1 ? 'P1 - Duas Folhas' : 'Folha Única'}</strong></p>
            
            {loading && (
              <div>
                <p>Gerando documento PDF...</p>
                <Button loading>Processando</Button>
              </div>
            )}
          </div>
        </Card>
      ),
    },
    {
      title: 'Concluído',
      content: (
        <Card title="🎉 Documento Gerado">
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <FileTextOutlined style={{ fontSize: '48px', color: '#1890ff' }} />
            <h2>PDF Gerado com Sucesso!</h2>
            <p>Tratativa ID: <strong>{tratativaId}</strong></p>
            <p>Tipo: <strong>{ehP1 ? 'Documento Completo (2 folhas)' : 'Folha Única'}</strong></p>
            
            <div style={{ marginTop: '30px' }}>
              <Button type="primary" size="large" onClick={baixarPDF}>
                📥 Baixar PDF
              </Button>
              
              <Button style={{ marginLeft: '10px' }} onClick={resetar}>
                🔄 Nova Tratativa
              </Button>
            </div>
          </div>
        </Card>
      ),
    },
  ];

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>🚀 Criação Completa de Tratativa</h1>
      
      <Steps current={currentStep} style={{ marginBottom: '30px' }}>
        {steps.map(item => (
          <Step key={item.title} title={item.title} />
        ))}
      </Steps>

      <div>{steps[currentStep].content}</div>
    </div>
  );
};

export default FluxoCompletoTratativa;
