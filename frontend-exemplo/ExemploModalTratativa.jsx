import React, { useState, useEffect } from 'react';
import { Modal, Button, Descriptions, Spin, message } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import axios from 'axios';
import BotaoExcluirTratativa from './BotaoExcluirTratativa';

/**
 * Exemplo de modal de tratativa que inclui botão de edição e exclusão
 * 
 * Este componente é apenas um exemplo de como integrar o botão de exclusão
 * em uma modal de tratativa existente.
 */
const ExemploModalTratativa = ({ tratativaId, visible, onClose, onTratativaExcluida }) => {
  const [tratativa, setTratativa] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const API_URL = 'https://iblogistica.ddns.net:3000/api/tratativa';
  
  // Carregar dados da tratativa quando o modal for aberto
  useEffect(() => {
    if (visible && tratativaId) {
      carregarTratativa();
    }
  }, [visible, tratativaId]);
  
  // Função para carregar os dados da tratativa
  const carregarTratativa = async () => {
    setLoading(true);
    try {
      // Na implementação real, você teria um endpoint para buscar tratativa por ID
      // Este é apenas um exemplo
      const response = await axios.get(`${API_URL}/get/${tratativaId}`);
      
      if (response.data.status === 'success') {
        setTratativa(response.data.data);
      } else {
        message.error('Erro ao carregar dados da tratativa');
      }
    } catch (error) {
      console.error('Erro ao carregar tratativa:', error);
      message.error('Erro de comunicação com o servidor');
    } finally {
      setLoading(false);
    }
  };
  
  // Função para editar a tratativa (seria implementada em um componente real)
  const handleEdit = () => {
    message.info('Funcionalidade de edição seria implementada aqui');
    // Normalmente abriria um formulário de edição ou redirecionaria para uma página de edição
  };
  
  // Função chamada quando a tratativa for excluída
  const handleTratativaExcluida = () => {
    message.success('Tratativa excluída com sucesso');
    onClose(); // Fechar o modal
    
    // Chamar função do componente pai para atualizar a lista
    if (onTratativaExcluida) {
      onTratativaExcluida();
    }
  };
  
  // Se não tiver dados, exibir spinner
  if (!tratativa && visible) {
    return (
      <Modal
        title="Detalhes da Tratativa"
        open={visible}
        onCancel={onClose}
        footer={null}
        width={800}
      >
        <div style={{ textAlign: 'center', padding: '30px' }}>
          <Spin size="large" />
          <p style={{ marginTop: '15px' }}>Carregando dados...</p>
        </div>
      </Modal>
    );
  }
  
  return (
    <Modal
      title={`Tratativa #${tratativa?.numero_tratativa}`}
      open={visible}
      onCancel={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button onClick={onClose}>Fechar</Button>
          <div>
            <Button 
              type="primary" 
              icon={<EditOutlined />} 
              onClick={handleEdit}
            >
              Editar
            </Button>
            {/* Aqui integramos o botão de exclusão */}
            {tratativa && (
              <BotaoExcluirTratativa
                tratativa={tratativa}
                onTratativaExcluida={handleTratativaExcluida}
                position="right"
              />
            )}
          </div>
        </div>
      }
      width={800}
    >
      {tratativa && (
        <Descriptions bordered column={2}>
          <Descriptions.Item label="Número" span={2}>
            {tratativa.numero_tratativa}
          </Descriptions.Item>
          <Descriptions.Item label="Funcionário" span={2}>
            {tratativa.funcionario}
          </Descriptions.Item>
          <Descriptions.Item label="Função">
            {tratativa.funcao}
          </Descriptions.Item>
          <Descriptions.Item label="Setor">
            {tratativa.setor}
          </Descriptions.Item>
          <Descriptions.Item label="Data da Infração">
            {new Date(tratativa.data_infracao).toLocaleDateString('pt-BR')}
          </Descriptions.Item>
          <Descriptions.Item label="Hora da Infração">
            {tratativa.hora_infracao}
          </Descriptions.Item>
          <Descriptions.Item label="Código da Infração">
            {tratativa.codigo_infracao}
          </Descriptions.Item>
          <Descriptions.Item label="Penalidade">
            {tratativa.penalidade}
          </Descriptions.Item>
          <Descriptions.Item label="Descrição da Infração" span={2}>
            {tratativa.descricao_infracao}
          </Descriptions.Item>
          <Descriptions.Item label="Líder">
            {tratativa.lider}
          </Descriptions.Item>
          <Descriptions.Item label="Documento">
            {tratativa.url_documento_enviado ? (
              <a href={tratativa.url_documento_enviado} target="_blank" rel="noopener noreferrer">
                Visualizar PDF
              </a>
            ) : (
              <span style={{ color: '#ff4d4f' }}>Não gerado</span>
            )}
          </Descriptions.Item>
        </Descriptions>
      )}
    </Modal>
  );
};

export default ExemploModalTratativa; 